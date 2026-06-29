import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';
import { PROGRAMS, GUIDED_WORKOUTS } from '../data/guidedWorkouts';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GOAL_COLORS = { 'Build Strength': '#7C8BF5', 'Burn Fat': '#E57373', 'Build Habit': '#4CAF7C', Flexibility: '#AB47BC' };
const DIFF_COLORS = { Beginner: '#4CAF7C', Intermediate: '#FFB74D', Advanced: '#E57373' };

function todayDOW() { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]; }
function weekNum()  { const d = new Date(); return Math.ceil((d - new Date(d.getFullYear(),0,1)) / 604800000); }

function ProgramCard({ prog, active, onPress, onStart }) {
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
      {!active && (
        <TouchableOpacity onPress={e => { e.stopPropagation?.(); onStart(); }} style={{ backgroundColor: accentColor, paddingVertical: 12, alignItems: 'center' }}>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#0A0A0A', fontWeight: '700' }}>START PROGRAM</Text>
        </TouchableOpacity>
      )}
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
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#E57373' }}>🛌  Rest Day</Text>
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
  const [activeId,   setActiveId]   = useState(null);
  const [progress,   setProgress]   = useState({});
  const [storageKey, setStorageKey] = useState(null);

  useEffect(() => {
    getUser().then(async u => {
      const key = `tg_programs_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        setActiveId(d.activeId || null);
        setProgress(d.progress || {});
      }
    });
  }, []);

  async function startProgram(prog) {
    const updated = { activeId: prog.id, progress: { [prog.id]: { week: 1, completedDays: [] } } };
    setActiveId(prog.id);
    setProgress(updated.progress);
    if (storageKey) await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
  }

  async function markDayComplete(progId, week, day) {
    const key = `${progId}_w${week}_${day}`;
    const prog = progress[progId] || { week: 1, completedDays: [] };
    if (prog.completedDays.includes(key)) return;
    const updated = { ...progress, [progId]: { ...prog, completedDays: [...prog.completedDays, key] } };
    setProgress(updated);
    if (storageKey) await AsyncStorage.setItem(storageKey, JSON.stringify({ activeId, progress: updated }));
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
  });

  // DETAIL VIEW
  if (detail) {
    const prog = PROGRAMS.find(p => p.id === detail);
    const isActive = activeId === prog.id;
    const progState = progress[prog.id] || { week: 1, completedDays: [] };
    const currentWeek = prog.schedule[Math.min(progState.week - 1, prog.schedule.length - 1)];

    return (
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
                        {done && <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#0A0A0A' }}>✓</Text>}
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

          {!isActive && (
            <TouchableOpacity style={{ backgroundColor: accentColor, paddingVertical: 16, alignItems: 'center', marginTop: 8 }} onPress={() => startProgram(prog)}>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700' }}>START THIS PROGRAM</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
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
            active={activeId === prog.id}
            onPress={() => setDetail(prog.id)}
            onStart={() => startProgram(prog)}
          />
        ))}

        {activeTab === 'plan' && storageKey && (
          <TrainingPlanTab storageKey={storageKey} />
        )}
      </View>
    </ScrollView>
  );
}
