import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';
import { awardXP } from '../api';
import { PROGRAMS, GUIDED_WORKOUTS } from '../data/guidedWorkouts';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GOAL_COLORS = { 'Build Strength': '#7C8BF5', 'Burn Fat': '#E57373', 'Build Habit': '#4CAF7C', Flexibility: '#AB47BC' };
const DIFF_COLORS = { Beginner: '#4CAF7C', Intermediate: '#FFB74D', Advanced: '#E57373' };

function todayDOW() { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]; }
function weekNum()  { const d = new Date(); return Math.ceil((d - new Date(d.getFullYear(),0,1)) / 604800000); }

function isoFor(date) { return date.toISOString().slice(0, 10); }
function mondayOfThisWeek() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

// Writes the chosen program's weekly schedule onto CalendarScreen's per-date
// block storage (tg_cal_blocks_<user>_<iso>), tagging each block with the
// program's id so it can be cleanly removed again if the program is cancelled.
async function syncProgramToCalendar(username, prog) {
  const monday = mondayOfThisWeek();
  const touchedDates = [];
  for (const wk of prog.schedule) {
    for (const d of wk.days) {
      const offset = (wk.week - 1) * 7 + DAYS.indexOf(d.day);
      const date = new Date(monday);
      date.setDate(monday.getDate() + offset);
      const iso = isoFor(date);
      const key = `tg_cal_blocks_${username}_${iso}`;
      const raw = await AsyncStorage.getItem(key);
      const existing = raw ? JSON.parse(raw) : [];
      const withoutThisProgram = existing.filter(b => b.programId !== prog.id);
      let updated = withoutThisProgram;
      if (!d.rest) {
        const wo = d.workoutId ? GUIDED_WORKOUTS.find(w => w.id === d.workoutId) : null;
        const startH = 7;
        const endH = startH + (wo?.duration ? wo.duration / 60 : 1);
        updated = [...withoutThisProgram, { id: `prog_${prog.id}_w${wk.week}_${d.day}`, programId: prog.id, startH, endH, name: d.label || wo?.name || 'Workout' }];
      }
      if (updated.length) await AsyncStorage.setItem(key, JSON.stringify(updated));
      else await AsyncStorage.removeItem(key);
      touchedDates.push(iso);
    }
  }
  return touchedDates;
}

async function removeProgramFromCalendar(username, prog, dates) {
  for (const iso of dates) {
    const key = `tg_cal_blocks_${username}_${iso}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;
    const filtered = JSON.parse(raw).filter(b => b.programId !== prog.id);
    if (filtered.length) await AsyncStorage.setItem(key, JSON.stringify(filtered));
    else await AsyncStorage.removeItem(key);
  }
}

function ProgramCard({ prog, active, onPress, onStart, onCancel }) {
  const { mc, accentColor } = useTheme();
  const gc = GOAL_COLORS[prog.goal] || accentColor;
  const dc = DIFF_COLORS[prog.difficulty] || mc.text3;
  return (
    <TouchableOpacity onPress={onPress} style={{ borderWidth: 1, borderColor: active ? accentColor : mc.border, padding: 16, marginBottom: 12 }}>
      {active && (
        <View style={{ backgroundColor: accentColor + '22', paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 9, color: accentColor }}>ACTIVE PROGRAM</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ backgroundColor: gc + '22', borderWidth: 1, borderColor: gc + '44', paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 9, color: gc }}>{prog.goal.toUpperCase()}</Text>
        </View>
        <Text style={{ fontFamily: F.mono, fontSize: 10, color: dc }}>{prog.difficulty}</Text>
      </View>
      <Text style={{ fontFamily: F.mono, fontSize: 14, color: mc.text, marginBottom: 6 }}>{prog.name}</Text>
      <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 10 }}>{prog.description}</Text>
      <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 12 }}>{prog.weeks} weeks · {prog.schedule[0].days.filter(d => !d.rest).length} days/week</Text>
      <TouchableOpacity
        onPress={e => { e.stopPropagation?.(); active ? onCancel() : onStart(); }}
        style={active
          ? { borderWidth: 1, borderColor: '#E57373', paddingVertical: 12, alignItems: 'center' }
          : { backgroundColor: accentColor, paddingVertical: 12, alignItems: 'center' }}
      >
        <Text style={{ fontFamily: F.mono, fontSize: 11, fontWeight: '700', color: active ? '#E57373' : '#0A0A0A' }}>
          {active ? 'CANCEL PROGRAM' : 'START PROGRAM'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Training Plan (weekly schedule builder) ───────────────────────────────────
function TrainingPlanTab({ storageKey }) {
  const { mc, accentColor } = useTheme();
  const [plan, setPlan] = useState({ Mon: null, Tue: null, Wed: null, Thu: null, Fri: null, Sat: null, Sun: null });
  const [picking, setPicking] = useState(null); // day being edited

  useEffect(() => {
    AsyncStorage.getItem(storageKey + '_plan').then(raw => { if (raw) setPlan(JSON.parse(raw)); });
  }, [storageKey]);

  async function assignDay(day, workout) {
    const updated = { ...plan, [day]: workout ? { id: workout.id, name: workout.name, category: workout.category, duration: workout.duration } : null };
    setPlan(updated);
    await AsyncStorage.setItem(storageKey + '_plan', JSON.stringify(updated));
    setPicking(null);
  }

  const today = todayDOW();
  const s = StyleSheet.create({
    label: { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 10 },
    dayRow:{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: mc.border },
    dayLbl:{ fontFamily: F.mono, fontSize: 12, color: mc.text, width: 40 },
    today: { color: accentColor },
    pill:  { flex: 1, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: mc.card || mc.border + '33', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    edit:  { fontFamily: F.mono, fontSize: 10, color: accentColor },
    rest:  { fontFamily: F.mono, fontSize: 11, color: mc.text3, flex: 1, paddingLeft: 10 },
    woName:{ fontFamily: F.mono, fontSize: 11, color: mc.text },
    woCat: { fontFamily: F.mono, fontSize: 9, color: mc.text3 },
    modal: { borderWidth: 1, borderColor: mc.border, backgroundColor: mc.bg, padding: 16, marginTop: 8 },
  });

  if (picking) {
    return (
      <View>
        <Text style={[s.label, { marginBottom: 8 }]}>ASSIGN WORKOUT FOR {picking}</Text>
        <TouchableOpacity onPress={() => assignDay(picking, null)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: mc.border }}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#E57373' }}>Rest Day</Text>
        </TouchableOpacity>
        {GUIDED_WORKOUTS.map(w => (
          <TouchableOpacity key={w.id} onPress={() => assignDay(picking, w)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: mc.border }}>
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{w.name}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{w.category} · {w.duration} min · {w.difficulty}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => setPicking(null)} style={{ paddingVertical: 14, alignItems: 'center', marginTop: 10 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <Text style={s.label}>YOUR WEEKLY TRAINING PLAN</Text>
      {DAYS.map(day => {
        const wo = plan[day];
        return (
          <View key={day} style={s.dayRow}>
            <Text style={[s.dayLbl, day === today && s.today]}>{day}</Text>
            {wo ? (
              <View style={s.pill}>
                <View>
                  <Text style={s.woName}>{wo.name}</Text>
                  <Text style={s.woCat}>{wo.category} · {wo.duration} min</Text>
                </View>
                <TouchableOpacity onPress={() => setPicking(day)}>
                  <Text style={s.edit}>Edit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setPicking(day)}>
                <Text style={s.rest}>+ Add workout</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function WorkoutProgramsScreen() {
  const { mc, accentColor } = useTheme();
  const [activeTab,  setActiveTab]  = useState('programs');
  const [detail,     setDetail]     = useState(null);
  const [activeIds,  setActiveIds]  = useState([]);
  const [progress,   setProgress]   = useState({});
  const [storageKey, setStorageKey] = useState(null);
  const [username,   setUsername]   = useState(null);
  const [toast,      setToast]      = useState('');
  const toastTimer = useRef(null);

  function flashToast(text) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }

  useEffect(() => {
    getUser().then(async u => {
      setUsername(u);
      const key = `tg_programs_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        setActiveIds(d.activeIds || (d.activeId ? [d.activeId] : []));
        setProgress(d.progress || {});
      }
    });
  }, []);

  async function startProgram(prog) {
    if (activeIds.includes(prog.id)) return;
    const dates = username ? await syncProgramToCalendar(username, prog) : [];
    const newIds = [...activeIds, prog.id];
    const newProgress = { ...progress, [prog.id]: { week: 1, completedDays: [], calDates: dates } };
    setActiveIds(newIds);
    setProgress(newProgress);
    if (storageKey) await AsyncStorage.setItem(storageKey, JSON.stringify({ activeIds: newIds, progress: newProgress }));
    flashToast(`Calendar auto-updated — ${prog.name} scheduled`);
  }

  async function cancelProgram(prog) {
    const newIds = activeIds.filter(id => id !== prog.id);
    const calDates = progress[prog.id]?.calDates || [];
    if (username) await removeProgramFromCalendar(username, prog, calDates);
    const newProgress = { ...progress };
    delete newProgress[prog.id];
    setActiveIds(newIds);
    setProgress(newProgress);
    if (storageKey) await AsyncStorage.setItem(storageKey, JSON.stringify({ activeIds: newIds, progress: newProgress }));
    flashToast(`${prog.name} cancelled — calendar updated`);
  }

  async function markDayComplete(progId, week, day) {
    const key = `${progId}_w${week}_${day}`;
    const prog = progress[progId] || { week: 1, completedDays: [] };
    if (prog.completedDays.includes(key)) return;
    const updated = { ...progress, [progId]: { ...prog, completedDays: [...prog.completedDays, key] } };
    setProgress(updated);
    if (storageKey) await AsyncStorage.setItem(storageKey, JSON.stringify({ activeIds, progress: updated }));
    awardXP('exercise').catch(() => {});

    // Auto-write to daily log so the workout shows in LogScreen & Dashboard
    try {
      const programData = PROGRAMS.find(p => p.id === progId);
      const weekSchedule = programData?.schedule?.[Math.min(week - 1, (programData.schedule?.length || 1) - 1)];
      const dayData = weekSchedule?.days?.find(d => d.day === day);
      const wo = dayData?.workoutId ? GUIDED_WORKOUTS.find(w => w.id === dayData.workoutId) : null;
      const woName = wo?.name || dayData?.name || programData?.name || 'Workout';
      const duration = wo?.duration || 45;
      const estBurn = Math.round(duration * 7.5);
      const todayISO = new Date().toISOString().slice(0, 10);
      const logKey = `toogood_daily_logs_${username}`;
      const raw = await AsyncStorage.getItem(logKey);
      const logs = raw ? JSON.parse(raw) : [];
      const idx = logs.findIndex(l => l.date === todayISO);
      const entry = idx >= 0 ? { ...logs[idx] } : { date: todayISO, foods: [], calories: 0, protein: 0, carbs: 0, fat: 0 };
      entry.workout = entry.workout ? `${entry.workout}; ${woName}` : `${woName} (${duration} min · ~${estBurn} kcal burned)`;
      if (idx >= 0) logs[idx] = entry; else logs.unshift(entry);
      await AsyncStorage.setItem(logKey, JSON.stringify(logs));
    } catch {}

    flashToast('Workout done — log updated & XP awarded!');
  }

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 16, maxWidth: 680, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
    tabs:    { flexDirection: 'row', gap: 8, marginBottom: 20 },
    tab:     { paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: mc.border },
    tabA:    { borderColor: accentColor, backgroundColor: accentColor + '18' },
    tabTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    tabTxA:  { color: accentColor },
    backBtn: { paddingVertical: 10, marginBottom: 16 },
    backTxt: { fontFamily: F.mono, fontSize: 12, color: accentColor },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 10 },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 14, marginBottom: 10 },
    toastWrap: { position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' },
    toastPill: { backgroundColor: accentColor, paddingHorizontal: 16, paddingVertical: 10 },
    toastTxt:  { fontFamily: F.mono, fontSize: 11, color: '#0A0A0A', fontWeight: '700' },
  });

  const toastEl = toast ? (
    <View style={s.toastWrap} pointerEvents="none">
      <View style={s.toastPill}><Text style={s.toastTxt}>{toast}</Text></View>
    </View>
  ) : null;

  // DETAIL VIEW
  if (detail) {
    const prog = PROGRAMS.find(p => p.id === detail);
    const isActive = activeIds.includes(prog.id);
    const progState = progress[prog.id] || { week: 1, completedDays: [] };
    const currentWeek = prog.schedule[Math.min(progState.week - 1, prog.schedule.length - 1)];

    return (
      <View style={{ flex: 1 }}>
      <ScrollView style={s.root}>
        <View style={s.content}>
          <TouchableOpacity style={s.backBtn} onPress={() => setDetail(null)}>
            <Text style={s.backTxt}>← All programs</Text>
          </TouchableOpacity>
          <Text style={s.title}>{prog.name}</Text>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 20 }}>
            {prog.difficulty} · {prog.weeks} weeks · {prog.goal}
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2, marginBottom: 20, lineHeight: 20 }}>{prog.description}</Text>

          {isActive && (
            <View style={{ borderWidth: 1, borderColor: accentColor + '44', padding: 14, marginBottom: 16, backgroundColor: accentColor + '08' }}>
              <Text style={[s.label, { color: accentColor }]}>WEEK {progState.week} SCHEDULE</Text>
              {currentWeek.days.map(d => {
                const key = `${prog.id}_w${progState.week}_${d.day}`;
                const done = progState.completedDays.includes(key);
                const isToday = d.day === todayDOW();
                const wo = d.workoutId ? GUIDED_WORKOUTS.find(w => w.id === d.workoutId) : null;
                return (
                  <View key={d.day} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border + '88' }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: isToday ? accentColor : mc.text3, width: 36 }}>{d.day}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 12, color: d.rest ? mc.text3 : mc.text }}>{d.label}</Text>
                      {wo && <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{wo.category} · {wo.duration} min</Text>}
                    </View>
                    {!d.rest && (
                      <TouchableOpacity onPress={() => markDayComplete(prog.id, progState.week, d.day)}
                        style={{ width: 28, height: 28, borderWidth: 1, borderColor: done ? accentColor : mc.border, backgroundColor: done ? accentColor : 'transparent', alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}>
                        {done && <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2.8} strokeLinecap="round"><Polyline points="20 6 9 17 4 12" /></Svg>}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <Text style={s.label}>FULL SCHEDULE</Text>
          {prog.schedule.map(wk => (
            <View key={wk.week} style={s.card}>
              <Text style={[s.label, { marginBottom: 10 }]}>WEEK {wk.week}</Text>
              {wk.days.map(d => {
                const wo = d.workoutId ? GUIDED_WORKOUTS.find(w => w.id === d.workoutId) : null;
                return (
                  <View key={d.day} style={{ flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: mc.border }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, width: 36 }}>{d.day}</Text>
                    <View>
                      <Text style={{ fontFamily: F.mono, fontSize: 11, color: d.rest ? mc.text3 : mc.text }}>{d.label}</Text>
                      {wo && <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{wo.duration} min</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}

          <TouchableOpacity
            style={isActive
              ? { borderWidth: 1, borderColor: '#E57373', paddingVertical: 16, alignItems: 'center', marginTop: 8 }
              : { backgroundColor: accentColor, paddingVertical: 16, alignItems: 'center', marginTop: 8 }}
            onPress={() => isActive ? cancelProgram(prog) : startProgram(prog)}
          >
            <Text style={{ fontFamily: F.mono, fontSize: 12, fontWeight: '700', color: isActive ? '#E57373' : '#0A0A0A' }}>
              {isActive ? 'CANCEL THIS PROGRAM' : 'START THIS PROGRAM'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {toastEl}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>Programs & Plans</Text>
        <Text style={s.sub}>STRUCTURED TRAINING</Text>

        <View style={s.tabs}>
          {[{ k: 'programs', l: 'Programs' }, { k: 'plan', l: 'Training Plan' }].map(t => (
            <TouchableOpacity key={t.k} style={[s.tab, activeTab === t.k && s.tabA]} onPress={() => setActiveTab(t.k)}>
              <Text style={[s.tabTxt, activeTab === t.k && s.tabTxA]}>{t.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'programs' && PROGRAMS.map(prog => (
          <ProgramCard
            key={prog.id}
            prog={prog}
            active={activeIds.includes(prog.id)}
            onPress={() => setDetail(prog.id)}
            onStart={() => startProgram(prog)}
            onCancel={() => cancelProgram(prog)}
          />
        ))}

        {activeTab === 'plan' && storageKey && (
          <TrainingPlanTab storageKey={storageKey} />
        )}
      </View>
    </ScrollView>
    {toastEl}
    </View>
  );
}
