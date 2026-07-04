import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, StyleSheet, ActivityIndicator,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { getToken, getUser } from '../auth';
import { calendarEdit, saveExerciseTimes, calendarRemind } from '../api';
import { HeatmapGrid } from '../components/Charts';

/* ── Constants ─────────────────────────────────────────────────────────── */

const WEEK_LONG  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const WEEK_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
// Sun-indexed (JS Date.getDay()) → Mon-indexed week label
const JS_DAY_TO_WEEK_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
// Calendar grid header: Sun..Sat (JS standard week)
const GRID_HEADERS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const WORKOUT_START_H = {
  early_morning: 5, morning: 7, afternoon: 15, evening: 18, flexible: 8,
};
const WORKOUT_DUR_H = {
  '30min': 0.5, '45min': 0.75, '1hr': 1, '90min': 1.5, '2hr': 2,
};
const MEALS = [
  { h: 8,  label: 'Breakfast' },
  { h: 13, label: 'Lunch'     },
  { h: 20, label: 'Dinner'    },
];
const INITIAL_AI_MSG = {
  role: 'ai',
  text: "Tell me what to change — rest days, exercise types, duration, time of day, anything. I'll update your calendar right away.",
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isoToDate(iso) {
  // Parse without timezone shift
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtHour(h) {
  if (h === 0 || h === 24) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function fmtTimeH(h) {
  const hh = Math.floor(h);
  const mm  = Math.round((h % 1) * 60);
  const period = hh < 12 ? 'AM' : 'PM';
  const disp  = hh === 0 || hh === 24 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${disp}:${String(mm).padStart(2,'0')} ${period}`;
}

function snapH(h) { return Math.round(h * 4) / 4; }

// Build the 7-column calendar grid cells for a given year/month.
// Returns array of { iso, day (1-31), inMonth } | null (padding).
// Grid starts on Sunday (JS default).
function buildGridCells(year, month) {
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // pad front
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = startDow - 1; i >= 0; i--) {
    const d   = prevMonthDays - i;
    const pm  = month === 0 ? 11 : month - 1;
    const py  = month === 0 ? year - 1 : year;
    cells.push({ iso: dateToISO(new Date(py, pm, d)), day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: dateToISO(new Date(year, month, d)), day: d, inMonth: true });
  }
  // pad end to complete the last row
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0  : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ iso: dateToISO(new Date(ny, nm, d)), day: d, inMonth: false });
  }
  return cells;
}

/* ── SVG mic icon ────────────────────────────────────────────────────────── */
function MicIcon({ size = 12, color = '#554430' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Line x1="12" y1="19" x2="12" y2="23" />
      <Line x1="8"  y1="23" x2="16" y2="23" />
    </Svg>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function CalendarScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  const now = new Date();

  // Month navigation
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // User / storage
  const [username, setUsername] = useState('');

  // Exercise schedule (loaded from AsyncStorage, synced after AI edits)
  const [exTypes,   setExTypes]   = useState([]);   // string[]
  const [perWeek,   setPerWeek]   = useState(0);
  const [restDays,  setRestDays]  = useState([]);   // ['Monday', ...]
  const [duration,  setDuration]  = useState('1hr');
  const [timePref,  setTimePref]  = useState('morning');
  // Per-exercise stored times: { 'running': { startH, endH }, ... }
  const [exTimes,   setExTimes]   = useState({});
  // Per-day blocks: { 'YYYY-MM-DD': [{ id, startH, endH, name }] }
  const [dayBlocks, setDayBlocks] = useState({});

  // Day view modal
  const [selectedISO, setSelectedISO] = useState(null);

  // AI editor
  const [aiOpen,    setAiOpen]    = useState(true);
  const [aiMsgs,    setAiMsgs]    = useState([INITIAL_AI_MSG]);
  const [aiInput,   setAiInput]   = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [micOn,     setMicOn]     = useState(false);
  const [toast,     setToast]     = useState({ text: '', err: false, vis: false });

  const aiScrollRef  = useRef(null);
  const toastTimer   = useRef(null);
  const micRef       = useRef(null);

  // Derived: which week-days are active vs optional
  const nonRest  = WEEK_LONG.filter(d => !restDays.includes(d));
  const active   = nonRest.slice(0, perWeek);
  const optional = nonRest.slice(perWeek);

  /* ── Load user + schedule ─────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const u = (await getUser()) || '';
      setUsername(u);
      await loadSchedule(u);
      await loadExTimes(u);
      await loadDayBlocks(u);
    })();
  }, []);

  async function loadSchedule(u) {
    try {
      const raw = await AsyncStorage.getItem(`tg_ex_schedule_${u}`);
      if (raw) {
        const s = JSON.parse(raw);
        applySchedule(s);
      }
    } catch {}
  }

  function applySchedule(s) {
    if (s.exercise_types  !== undefined)
      setExTypes((s.exercise_types || '').split(',').map(t => t.trim()).filter(Boolean));
    if (s.exercise_days_per_week !== undefined)
      setPerWeek(parseInt(s.exercise_days_per_week) || 0);
    if (s.rest_day !== undefined)
      setRestDays((s.rest_day || '').split(',').map(t => t.trim()).filter(Boolean));
    if (s.session_duration)  setDuration(s.session_duration);
    if (s.workout_time_pref) setTimePref(s.workout_time_pref);
  }

  async function loadExTimes(u) {
    try {
      const raw = await AsyncStorage.getItem(`tg_ex_times_${u}`);
      if (raw) setExTimes(JSON.parse(raw));
    } catch {}
  }

  async function loadDayBlocks(u) {
    try {
      const keys   = await AsyncStorage.getAllKeys();
      const prefix = `tg_cal_blocks_${u}_`;
      const mine   = keys.filter(k => k.startsWith(prefix));
      if (!mine.length) return;
      const pairs  = await AsyncStorage.multiGet(mine);
      const out    = {};
      pairs.forEach(([k, v]) => {
        try { out[k.slice(prefix.length)] = JSON.parse(v); } catch {}
      });
      setDayBlocks(out);
    } catch {}
  }

  async function saveDayBlock(iso, blocks) {
    const key = `tg_cal_blocks_${username}_${iso}`;
    await AsyncStorage.setItem(key, JSON.stringify(blocks));
    setDayBlocks(prev => ({ ...prev, [iso]: blocks }));
  }

  /* ── Month navigation ─────────────────────────────────────────────────── */
  function navMonth(dir) {
    let m = month + dir, y = year;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setMonth(m); setYear(y);
  }

  /* ── Day classification helpers ───────────────────────────────────────── */
  function dayTypeForISO(iso) {
    const jsDay  = isoToDate(iso).getDay();       // 0=Sun
    const wl     = JS_DAY_TO_WEEK_LONG[jsDay];    // 'Monday' etc.
    const isRest = restDays.includes(wl);
    const isAct  = active.includes(wl);
    const isOpt  = optional.includes(wl);
    return { wl, isRest, isAct, isOpt };
  }

  // Returns exercise blocks for a given ISO date.
  // If blocks key exists use it; if not AND day is active → default from schedule.
  function blocksForDay(iso, isAct) {
    const stored = dayBlocks[iso];
    if (stored !== undefined) return stored;
    if (!isAct || !exTypes.length) return [];
    const durH    = WORKOUT_DUR_H[duration] || 1;
    const baseH   = WORKOUT_START_H[timePref] || 8;
    return exTypes.map((ex, i) => {
      const t = exTimes[ex.toLowerCase().trim()];
      return {
        id:     `sched${i}`,
        startH: t ? t.startH : baseH + i,
        endH:   t ? t.endH   : baseH + i + durH,
        name:   ex,
      };
    });
  }

  // Chips to show in calendar cell
  function chipsForCell(iso, isAct) {
    const blks = blocksForDay(iso, isAct);
    const names = [...new Set(blks.map(b => b.name).filter(Boolean))];
    return names;
  }

  /* ── Toast ────────────────────────────────────────────────────────────── */
  function showToast(text, err = false) {
    clearTimeout(toastTimer.current);
    setToast({ text, err, vis: true });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, vis: false })), 4000);
  }

  /* ── AI editor ────────────────────────────────────────────────────────── */
  function toggleMic() {
    if (micOn) {
      try { micRef.current?.stop(); } catch {}
      setMicOn(false);
      return;
    }
    const SR = typeof window !== 'undefined' &&
               (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;
    let final = '';
    const r = new SR();
    micRef.current = r;
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';
    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
        else interim = e.results[i][0].transcript;
      }
      setAiInput((final + interim).trim());
    };
    r.onerror = () => { setMicOn(false); };
    r.onend   = () => { if (micRef.current === r) r.start(); };
    r.start();
    setMicOn(true);
  }

  async function sendAi() {
    const instruction = aiInput.trim();
    if (!instruction || aiLoading) return;
    if (micOn) { try { micRef.current?.stop(); } catch {} setMicOn(false); }
    setAiInput('');
    setAiMsgs(m => [...m, { role: 'user', text: instruction }]);
    setAiLoading(true);

    try {
      const data = await calendarEdit({ instruction });
      if (data.ok && data.schedule) {
        const s = data.schedule;
        // Compute new schedule values
        const newTypes    = (s.exercise_types || '').split(',').map(t => t.trim()).filter(Boolean);
        const newRestDays = (s.rest_day || '').split(',').map(t => t.trim()).filter(Boolean);
        const newPerWeek  = parseInt(s.exercise_days_per_week) || perWeek;
        const newDuration = s.session_duration  || duration;
        const newTimePref = s.workout_time_pref || timePref;

        setExTypes(newTypes);
        setRestDays(newRestDays);
        setPerWeek(newPerWeek);
        setDuration(newDuration);
        setTimePref(newTimePref);

        // Save schedule to AsyncStorage
        await AsyncStorage.setItem(`tg_ex_schedule_${username}`, JSON.stringify(s));

        // Store per-exercise times from AI response
        let newExTimes = { ...exTimes };
        if (s.exercise_schedule && typeof s.exercise_schedule === 'object') {
          Object.entries(s.exercise_schedule).forEach(([exName, times]) => {
            if (times && times.startH != null && times.endH != null) {
              newExTimes[exName.toLowerCase().trim()] = { startH: times.startH, endH: times.endH };
            }
          });
        }
        setExTimes(newExTimes);
        await AsyncStorage.setItem(`tg_ex_times_${username}`, JSON.stringify(newExTimes));

        // Refresh day blocks for next 90 days
        const newNonRest  = WEEK_LONG.filter(d => !newRestDays.includes(d));
        const newActive   = newNonRest.slice(0, newPerWeek);
        const durH        = WORKOUT_DUR_H[newDuration] || 1;
        const baseH       = WORKOUT_START_H[newTimePref] || 8;

        const updatedBlocks = { ...dayBlocks };
        const todayDate = new Date(); todayDate.setHours(0,0,0,0);
        for (let offset = 0; offset <= 90; offset++) {
          const d  = new Date(todayDate); d.setDate(d.getDate() + offset);
          const wl = JS_DAY_TO_WEEK_LONG[d.getDay()];
          if (!newActive.includes(wl)) continue;
          const iso = dateToISO(d);
          const key = `tg_cal_blocks_${username}_${iso}`;
          let existing = [];
          try {
            const raw = await AsyncStorage.getItem(key);
            existing = raw ? JSON.parse(raw) : [];
          } catch {}
          // Remove old sched* blocks, keep manual ones
          const manual = existing.filter(b => !b.id.startsWith('sched'));
          const fresh  = newTypes.map((ex, i) => {
            const t = newExTimes[ex.toLowerCase().trim()];
            return {
              id:     `sched${i}`,
              startH: t ? t.startH : baseH + i,
              endH:   t ? t.endH   : baseH + i + durH,
              name:   ex,
            };
          });
          const merged = [...fresh, ...manual];
          updatedBlocks[iso] = merged;
          await AsyncStorage.setItem(key, JSON.stringify(merged));
        }
        setDayBlocks(updatedBlocks);

        // Push exercise times to server
        if (Object.keys(newExTimes).length) {
          saveExerciseTimes({ times: newExTimes }).catch(() => {});
        }

        const reply = data.explanation || 'Schedule updated.';
        setAiMsgs(m => [...m, { role: 'ai', text: reply }]);
        showToast(reply);
      } else {
        const err = data.error || 'Something went wrong.';
        setAiMsgs(m => [...m, { role: 'ai', text: err }]);
        showToast(err, true);
      }
    } catch {
      const msg = 'Network error — try again.';
      setAiMsgs(m => [...m, { role: 'ai', text: msg }]);
      showToast(msg, true);
    }

    setAiLoading(false);
    setTimeout(() => aiScrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  /* ── Calendar grid ────────────────────────────────────────────────────── */
  const cells  = buildGridCells(year, month);
  const today  = todayISO();

  /* ── Activity density heatmap (current month, in-month cells only) ───── */
  const monthCells = cells.filter(c => c.inMonth);
  const monthBlockCounts = monthCells.map(c => {
    const { isAct } = dayTypeForISO(c.iso);
    return blocksForDay(c.iso, isAct).length;
  });
  const maxBlockCount = Math.max(...monthBlockCounts, 1);
  const heatmapCells = monthCells.map((c, i) => ({
    key: c.iso,
    intensity: monthBlockCounts[i] / maxBlockCount,
  }));
  const totalActivities = monthBlockCounts.reduce((s, n) => s + n, 0);
  const activeDaysCount = monthBlockCounts.filter(n => n > 0).length;

  /* ── Selected day blocks ──────────────────────────────────────────────── */
  const selType   = selectedISO ? dayTypeForISO(selectedISO) : null;
  const selBlocks = selectedISO
    ? blocksForDay(selectedISO, selType?.isAct ?? false)
    : [];

  /* ── Styles (theme-reactive) ──────────────────────────────────────────── */
  const st = makeStyles(mc, accentColor, fontSize, borderRadius);

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <View style={st.screen}>
      <ScrollView contentContainerStyle={st.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Page header */}
        <View style={st.pageHeader}>
          <Text style={st.pageTitle}>Exercise Calendar</Text>
          <Text style={st.pageSub}>
            Your monthly workout plan — auto-updates when you change your exercise schedule.
          </Text>
          <TouchableOpacity
            style={st.actionLink}
            onPress={() => navigation.navigate('Settings')}>
            <Text style={st.actionLinkTxt}>Edit schedule</Text>
          </TouchableOpacity>
        </View>

        {/* ── AI schedule editor panel (ABOVE calendar) ── */}
        <View style={st.editPanel}>
          <View style={st.editHeader}>
            <Text style={st.editTitle}>AI Schedule Editor — edit by voice or text</Text>
            <TouchableOpacity onPress={() => setAiOpen(o => !o)}>
              <Text style={st.editToggle}>{aiOpen ? 'hide ▴' : 'show ▾'}</Text>
            </TouchableOpacity>
          </View>
          {aiOpen && (
            <>
              <ScrollView
                style={st.editMsgs}
                ref={aiScrollRef}
                onContentSizeChange={() => aiScrollRef.current?.scrollToEnd({ animated: false })}>
                {aiMsgs.map((msg, i) => (
                  <View key={i} style={[st.editMsg, msg.role === 'user' ? st.editMsgUser : st.editMsgAi]}>
                    <View style={[st.editBubble, msg.role === 'user' ? st.editBubbleUser : st.editBubbleAi]}>
                      <Text style={[st.editBubbleTxt, msg.role === 'user' && { color: mc.text }]}>
                        {msg.text}
                      </Text>
                    </View>
                  </View>
                ))}
                {aiLoading && (
                  <View style={st.editMsgAi}>
                    <View style={st.editBubbleAi}>
                      <Text style={[st.editBubbleTxt, { fontStyle: 'italic' }]}>Updating…</Text>
                    </View>
                  </View>
                )}
              </ScrollView>
              <Text style={st.editHint}>
                e.g. "Rest on Sunday only, add swimming, change to morning sessions"
              </Text>
              <View style={st.editRow}>
                <TouchableOpacity
                  style={[st.editMicBtn, micOn && st.editMicBtnOn]}
                  onPress={toggleMic}>
                  <MicIcon size={12} color={micOn ? accentColor : mc.text3} />
                  <Text style={[st.editMicTxt, micOn && { color: accentColor }]}>Mic</Text>
                </TouchableOpacity>
                <TextInput
                  style={st.editInp}
                  value={aiInput}
                  onChangeText={setAiInput}
                  placeholder="Describe what to change…"
                  placeholderTextColor={mc.text3}
                  onSubmitEditing={sendAi}
                  returnKeyType="send"
                  editable={!aiLoading}
                />
                <TouchableOpacity
                  style={[st.editSend, aiLoading && { opacity: 0.45 }]}
                  onPress={sendAi}
                  disabled={aiLoading}>
                  <Text style={st.editSendTxt}>Update</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* ── Calendar nav ── */}
        <View style={st.calNav}>
          <TouchableOpacity style={st.calArrow} onPress={() => navMonth(-1)}>
            <Text style={st.calArrowTxt}>← prev month</Text>
          </TouchableOpacity>
          <Text style={st.calMonthLabel}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity style={st.calArrow} onPress={() => navMonth(1)}>
            <Text style={st.calArrowTxt}>next month →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Grid header (Sun – Sat) ── */}
        <View style={st.gridRow}>
          {GRID_HEADERS.map(h => (
            <View key={h} style={st.gridHeaderCell}>
              <Text style={st.gridHeaderTxt}>{h}</Text>
            </View>
          ))}
        </View>

        {/* ── Day cells ── */}
        <View style={st.grid}>
          {cells.map((cell, idx) => {
            const isToday    = cell.iso === today;
            const isPast     = cell.iso < today;
            const { isRest, isAct, isOpt } = dayTypeForISO(cell.iso);
            const chips      = isAct && cell.inMonth && !isPast
              ? chipsForCell(cell.iso, isAct)
              : [];

            const cellStyle = [
              st.dayCell,
              !cell.inMonth || isPast ? st.dayCellFaded : null,
              isRest   ? st.dayCellRest     : null,
              isOpt    ? st.dayCellOptional  : null,
              isToday  ? st.dayCellToday     : null,
            ];

            return (
              <TouchableOpacity
                key={`${cell.iso}_${idx}`}
                style={cellStyle}
                onPress={() => setSelectedISO(cell.iso)}
                activeOpacity={0.75}>
                {/* Day-of-week label */}
                <Text style={st.calDayName}>
                  {GRID_HEADERS[isoToDate(cell.iso).getDay()].slice(0, 3).toUpperCase()}
                </Text>
                {/* Date number */}
                <Text style={[st.calDateNum, isToday && { color: accentColor }]}>
                  {cell.day}
                </Text>
                {/* Today dot */}
                {isToday && <View style={st.calTodayDot} />}
                {/* Exercise chips */}
                {chips.slice(0, 3).map((name, ci) => (
                  <View key={ci} style={st.calExChip}>
                    <Text style={st.calExChipTxt} numberOfLines={1}>{name}</Text>
                  </View>
                ))}
                {chips.length > 3 && (
                  <Text style={st.calExMeta}>+{chips.length - 3} more</Text>
                )}
                {/* Rest / Optional labels */}
                {isRest && cell.inMonth && (
                  <Text style={[st.calRestLbl, { marginTop: 'auto' }]}>Rest</Text>
                )}
                {isOpt && cell.inMonth && !isPast && chips.length === 0 && (
                  <Text style={[st.calOptLbl, { marginTop: 'auto' }]}>Optional</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Activity density heatmap (supplementary summary) ── */}
        <View style={st.heatmapCard}>
          <Text style={st.heatmapLabel}>Activity density — {MONTHS[month]}</Text>
          <HeatmapGrid cells={heatmapCells} color={accentColor} mc={mc} columns={7} cellSize={16} gap={4} />
          <Text style={st.heatmapCaption}>
            {totalActivities} scheduled {totalActivities === 1 ? 'activity' : 'activities'} across {activeDaysCount} {activeDaysCount === 1 ? 'day' : 'days'} this month
          </Text>
        </View>

      </ScrollView>

      {/* ── Toast ── */}
      {toast.vis && (
        <View style={[st.toast, toast.err && st.toastErr]}>
          <Text style={[st.toastTxt, toast.err && { color: C.red }]} numberOfLines={2}>
            {toast.text}
          </Text>
        </View>
      )}

      {/* ── Day view modal ── */}
      <Modal
        visible={!!selectedISO}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedISO(null)}>
        <TouchableOpacity
          style={st.modalBd}
          activeOpacity={1}
          onPress={() => setSelectedISO(null)}>
          <TouchableOpacity
            activeOpacity={1}
            style={st.modalSheet}
            onPress={() => {}}>
            <DayViewModal
              iso={selectedISO}
              blocks={selBlocks}
              selType={selType}
              onClose={() => setSelectedISO(null)}
              onSaveBlocks={newBlocks => saveDayBlock(selectedISO, newBlocks)}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ── DayViewModal ────────────────────────────────────────────────────────── */
const DV_START = 5;
const DV_END   = 23;
const HR_PX    = 60;
const DV_TOTAL = (DV_END - DV_START) * HR_PX;

function hToY(h) { return (h - DV_START) * HR_PX; }

function DayViewModal({ iso, blocks, selType, onClose, onSaveBlocks }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  const st = makeStyles(mc, accentColor, fontSize, borderRadius);
  const [localBlocks,  setLocalBlocks]  = useState(blocks || []);
  const [pendingBlock, setPendingBlock] = useState(null); // { startH, endH, name }
  const pendingRef = useRef(null);
  const [emailStatus, setEmailStatus] = useState(''); // '' | 'sending' | 'sent' | 'error'
  const [emailMsg,    setEmailMsg]    = useState('');

  async function handleEmailReminder() {
    if (emailStatus === 'sending') return;
    setEmailStatus('sending');
    try {
      const date = isoToDate(iso);
      const label = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const d = await calendarRemind(label, localBlocks);
      if (d.ok) {
        setEmailStatus('sent');
        setEmailMsg(d.msg || 'Schedule sent!');
      } else {
        setEmailStatus('error');
        setEmailMsg(d.error || 'Could not send email.');
      }
    } catch {
      setEmailStatus('error');
      setEmailMsg('Could not reach server.');
    }
    setTimeout(() => { setEmailStatus(''); setEmailMsg(''); }, 4000);
  }

  useEffect(() => { setLocalBlocks(blocks || []); }, [blocks]);

  function deleteBlock(id) {
    const updated = localBlocks.filter(b => b.id !== id);
    setLocalBlocks(updated);
    onSaveBlocks(updated);
  }

  function updateBlockName(id, name) {
    setLocalBlocks(prev => prev.map(b => b.id === id ? { ...b, name } : b));
  }

  function saveBlockName(id, name) {
    const updated = localBlocks.map(b => b.id === id ? { ...b, name } : b);
    setLocalBlocks(updated);
    onSaveBlocks(updated);
  }

  function updateBlockTime(id, field, val) {
    setLocalBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: val } : b));
  }

  function saveBlock(id) {
    setLocalBlocks(prev => { onSaveBlocks(prev); return prev; });
  }

  function addBlock(name, startH, endH) {
    const b = { id: Date.now().toString(), startH, endH, name };
    const updated = [...localBlocks, b];
    setLocalBlocks(updated);
    onSaveBlocks(updated);
    setPendingBlock(null);
  }

  function commitPending() {
    if (pendingBlock && pendingBlock.name.trim()) {
      addBlock(pendingBlock.name.trim(), pendingBlock.startH, pendingBlock.endH);
    } else {
      setPendingBlock(null);
    }
  }

  function handleTimelineTap(e) {
    if (!e || !e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawH = y / HR_PX + DV_START;
    const h = snapH(Math.max(DV_START, Math.min(DV_END - 1, rawH)));
    setPendingBlock({ startH: h, endH: Math.min(h + 1, DV_END), name: '' });
    setTimeout(() => { if (pendingRef.current) pendingRef.current.focus(); }, 80);
  }

  if (!iso) return null;
  const date   = isoToDate(iso);
  const title  = date.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const { isRest, isAct, isOpt } = selType || {};
  const badge = isRest ? 'Rest day' : isAct ? 'Exercise day' : isOpt ? 'Optional' : 'Free day';
  const badgeStyle = isRest ? st.badgeRest : isAct ? st.badgeExercise
                   : isOpt  ? st.badgeOpt  : st.badgeFree;

  const todayISO_ = todayISO();
  const isToday   = iso === todayISO_;
  const nowH      = isToday
    ? (new Date().getHours() + new Date().getMinutes() / 60)
    : null;

  return (
    <>
      {/* Header */}
      <View style={st.dvHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.dvTitle}>{title}</Text>
          <View style={[st.dvBadge, badgeStyle]}>
            <Text style={[st.dvBadgeTxt, isAct && { color: accentColor }]}>{badge}</Text>
          </View>
        </View>
        {/* Email schedule button */}
        <TouchableOpacity
          onPress={handleEmailReminder}
          disabled={emailStatus === 'sending'}
          style={{
            paddingHorizontal: 10, paddingVertical: 4,
            borderWidth: 1,
            borderColor: emailStatus === 'sent' ? '#4CAF7C' : emailStatus === 'error' ? '#CF6679' : mc.border,
            marginRight: 8, justifyContent: 'center',
            opacity: emailStatus === 'sending' ? 0.5 : 1,
          }}
        >
          <Text style={{ color: emailStatus === 'sent' ? '#4CAF7C' : emailStatus === 'error' ? '#CF6679' : mc.text2, fontSize: 10, fontFamily: F.mono, letterSpacing: 1.5 }}>
            {emailStatus === 'sending' ? '…' : emailStatus === 'sent' ? 'SENT' : emailStatus === 'error' ? 'ERR' : 'EMAIL'}
          </Text>
        </TouchableOpacity>
        {/* + Add block button */}
        {!isRest && (
          <TouchableOpacity
            onPress={() => { setPendingBlock({ startH: 9, endH: 10, name: '' }); setTimeout(() => { if (pendingRef.current) pendingRef.current.focus(); }, 80); }}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: accentColor, marginRight: 10, justifyContent: 'center', alignItems: 'center' }}
          >
            <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth={2.2} strokeLinecap="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onClose} style={{ paddingLeft: 8, paddingRight: 4, paddingVertical: 6 }}>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={mc.text3} strokeWidth={1.8} strokeLinecap="round">
            <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
          </Svg>
        </TouchableOpacity>
      </View>
      {/* Email feedback bar */}
      {!!emailMsg && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: mc.border, backgroundColor: mc.elevated }}>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: emailStatus === 'sent' ? '#4CAF7C' : '#CF6679' }}>{emailMsg}</Text>
        </View>
      )}

      {/* Hint bar */}
      {!isRest && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: mc.border, backgroundColor: mc.elevated }}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 0.5 }}>
            Tap the timeline to add a block · Drag top/bottom handles to resize
          </Text>
        </View>
      )}

      {/* Body */}
      <ScrollView style={{ maxHeight: 480 }}>
        {isRest ? (
          <View style={st.dvRestMsg}>
            <Text style={st.dvRestTxt}>
              Rest day — no workout scheduled.{'\n'}Recovery is part of the plan.
            </Text>
          </View>
        ) : (
          <View
            style={{ position: 'relative', height: DV_TOTAL + 16, marginBottom: 16 }}
            onClick={handleTimelineTap}
          >
            {/* Hour grid lines */}
            {Array.from({ length: DV_END - DV_START + 1 }, (_, i) => i + DV_START).map(h => (
              <View key={h} style={[st.dvHrLine, { top: hToY(h) }]} />
            ))}
            {/* Hour labels */}
            {Array.from({ length: DV_END - DV_START }, (_, i) => i + DV_START).map(h => (
              <Text key={`lbl${h}`} style={[st.dvHrLbl, { top: hToY(h) + 3 }]}>
                {fmtHour(h)}
              </Text>
            ))}
            {/* Meal markers */}
            {MEALS.map(({ h, label }) =>
              h >= DV_START && h <= DV_END ? (
                <View key={label} style={[st.dvMealPill, { top: hToY(h) - 10 }]}>
                  <Text style={st.dvMealTxt}>{label}</Text>
                </View>
              ) : null
            )}
            {/* Exercise blocks */}
            {localBlocks.map(b => (
              <BlockItem
                key={b.id}
                block={b}
                mc={mc}
                accentColor={accentColor}
                onDelete={() => deleteBlock(b.id)}
                onChangeName={name => updateBlockName(b.id, name)}
                onBlurName={name  => saveBlockName(b.id, name)}
                onUpdateTime={(field, val) => updateBlockTime(b.id, field, val)}
                onSaveBlock={() => saveBlock(b.id)}
              />
            ))}
            {/* Pending new block */}
            {pendingBlock && (
              <View
                style={{
                  position: 'absolute',
                  left: 52, right: 8,
                  top: hToY(pendingBlock.startH),
                  height: Math.max(56, hToY(pendingBlock.endH) - hToY(pendingBlock.startH)),
                  backgroundColor: `${accentColor}18`,
                  borderWidth: 1,
                  borderColor: accentColor,
                  borderStyle: 'dashed',
                  paddingHorizontal: 8,
                  paddingTop: 6,
                  zIndex: 300,
                }}
                onClick={e => e.stopPropagation()}
              >
                <TextInput
                  ref={pendingRef}
                  style={{ color: accentColor, fontFamily: F.mono, fontSize: fontSize, outlineWidth: 0, borderWidth: 0, padding: 0 }}
                  placeholder="Name this block…"
                  placeholderTextColor={`${accentColor}55`}
                  value={pendingBlock.name}
                  onChangeText={name => setPendingBlock(p => ({ ...p, name }))}
                  onSubmitEditing={commitPending}
                  returnKeyType="done"
                  onKeyPress={e => { if (e.nativeEvent.key === 'Escape') setPendingBlock(null); }}
                />
                <Text style={{ fontFamily: F.mono, fontSize: 9, color: `${accentColor}88`, marginTop: 4 }}>
                  {fmtTimeH(pendingBlock.startH)} – {fmtTimeH(pendingBlock.endH)} · Enter to save
                </Text>
                <TouchableOpacity onPress={() => setPendingBlock(null)} style={{ position: 'absolute', top: 6, right: 6, padding: 2 }}>
                  <Svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke={mc.text3} strokeWidth={2.5} strokeLinecap="round">
                    <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
                  </Svg>
                </TouchableOpacity>
              </View>
            )}
            {/* Current time line */}
            {isToday && nowH && nowH >= DV_START && nowH < DV_END && (
              <View style={[st.dvNowLine, { top: hToY(nowH) }]} />
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}

/* ── BlockItem ───────────────────────────────────────────────────────────── */
const EDGE_PX = 10; // px from top/bottom edge that triggers resize cursor

function BlockItem({ block, mc, accentColor, onDelete, onChangeName, onBlurName, onUpdateTime, onSaveBlock }) {
  const { fontSize, borderRadius } = useTheme();
  const st     = makeStyles(mc, accentColor, fontSize, borderRadius);
  const top    = hToY(block.startH);
  const height = Math.max(44, hToY(block.endH) - hToY(block.startH) - 2);

  // Always-fresh refs for use inside DOM event handlers
  const blockRef        = useRef(block);
  const onUpdateTimeRef = useRef(onUpdateTime);
  const onSaveBlockRef  = useRef(onSaveBlock);
  useEffect(() => { blockRef.current = block; });
  useEffect(() => { onUpdateTimeRef.current = onUpdateTime; });
  useEffect(() => { onSaveBlockRef.current  = onSaveBlock; });

  const elRef = useRef(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el || typeof document === 'undefined') return;

    function getEdge(e) {
      const rect = el.getBoundingClientRect();
      const fromTop    = e.clientY - rect.top;
      const fromBottom = rect.bottom - e.clientY;
      if (fromBottom <= EDGE_PX) return 'bottom';
      if (fromTop    <= EDGE_PX) return 'top';
      return null;
    }

    function onMouseMove(e) {
      const edge = getEdge(e);
      el.style.cursor = edge === 'bottom' ? 's-resize'
                      : edge === 'top'    ? 'n-resize'
                      : 'grab';
    }

    function onMouseLeave() { el.style.cursor = 'grab'; }

    function onMouseDown(e) {
      if (e.target && e.target.tagName === 'INPUT') return;
      const edge   = getEdge(e);
      const startY = e.clientY;
      e.preventDefault();
      e.stopPropagation();

      if (edge) {
        // ── Resize ──
        const origH = edge === 'top' ? blockRef.current.startH : blockRef.current.endH;
        function onMove(me) {
          const newH = snapH(origH + (me.clientY - startY) / HR_PX);
          if (edge === 'top') {
            onUpdateTimeRef.current('startH', Math.max(DV_START, Math.min(blockRef.current.endH - 0.25, newH)));
          } else {
            onUpdateTimeRef.current('endH', Math.min(DV_END, Math.max(blockRef.current.startH + 0.25, newH)));
          }
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup',   onUp);
          onSaveBlockRef.current();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
      } else {
        // ── Move whole block ──
        const origStart = blockRef.current.startH;
        const dur       = blockRef.current.endH - origStart;
        function onMove(me) {
          const newStart = snapH(Math.max(DV_START, Math.min(DV_END - dur, origStart + (me.clientY - startY) / HR_PX)));
          onUpdateTimeRef.current('startH', newStart);
          onUpdateTimeRef.current('endH',   newStart + dur);
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup',   onUp);
          onSaveBlockRef.current();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
      }
    }

    el.addEventListener('mousemove',  onMouseMove);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('mousedown',  onMouseDown);
    return () => {
      el.removeEventListener('mousemove',  onMouseMove);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('mousedown',  onMouseDown);
    };
  }, []);

  return (
    <View ref={elRef} style={[st.dvBlock, { top, height, cursor: 'grab' }]} onClick={e => e.stopPropagation()}>
      <TextInput
        style={[st.dvBlockName, { pointerEvents: 'auto' }]}
        value={block.name}
        onChangeText={onChangeName}
        onBlur={e => onBlurName(e.nativeEvent.text)}
        placeholder="Name this block…"
        placeholderTextColor={`${accentColor}55`}
        onClick={e => e.stopPropagation()}
      />
      <Text style={st.dvBlockTime}>
        {fmtTimeH(block.startH)} – {fmtTimeH(block.endH)}
      </Text>
      <TouchableOpacity
        style={st.dvBlockDel}
        onPress={onDelete}
        onClick={e => e.stopPropagation()}
      >
        <Svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke={mc.text3} strokeWidth={2.5} strokeLinecap="round">
          <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}

/* ── makeStyles ──────────────────────────────────────────────────────────── */
function makeStyles(mc, accentColor, fontSize, borderRadius) {
  return StyleSheet.create({
    /* ── Screen / layout ── */
    screen:       { flex: 1, backgroundColor: mc.bg },
    scrollContent: { paddingBottom: 60 },

    /* ── Page header ── */
    pageHeader: {
      padding: 24,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    pageTitle: {
      fontFamily: F.display,
      fontSize: 22,
      color: mc.text,
      letterSpacing: 1,
      marginBottom: 6,
    },
    pageSub: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text2,
      lineHeight: 20,
      marginBottom: 10,
    },
    actionLink: { alignSelf: 'flex-start' },
    actionLinkTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: accentColor,
      textDecorationLine: 'underline',
      letterSpacing: 1,
    },

    /* ── AI edit panel ── */
    editPanel: {
      margin: 16,
      borderWidth: 1,
      borderColor: mc.border,
      backgroundColor: mc.surface,
    },
    editHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    editTitle: {
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      color: mc.text2,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    editToggle: {
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      color: mc.text3,
      letterSpacing: 1,
    },
    editMsgs: {
      maxHeight: 180,
      padding: 12,
    },
    editMsg: { marginBottom: 8 },
    editMsgUser: { alignItems: 'flex-end' },
    editMsgAi:   { alignItems: 'flex-start' },
    editBubble: {
      maxWidth: '85%',
      padding: 10,
      borderWidth: 1,
    },
    editBubbleUser: {
      backgroundColor: mc.elevated,
      borderColor: mc.borderH,
    },
    editBubbleAi: {
      backgroundColor: mc.bg,
      borderColor: mc.border,
    },
    editBubbleTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text2,
      lineHeight: 18,
    },
    editHint: {
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      color: mc.text3,
      paddingHorizontal: 14,
      paddingBottom: 8,
      letterSpacing: 0.5,
      fontStyle: 'italic',
    },
    editRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderTopWidth: 1,
      borderTopColor: mc.border,
    },
    editMicBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: mc.border,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    editMicBtnOn: {
      borderColor: accentColor,
      backgroundColor: mc.goldDim,
    },
    editMicTxt: {
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      color: mc.text3,
      letterSpacing: 1,
    },
    editInp: {
      flex: 1,
      backgroundColor: mc.elevated,
      borderWidth: 1,
      borderColor: mc.border,
      color: mc.text,
      fontFamily: F.mono,
      fontSize: fontSize,
      paddingHorizontal: 12,
      paddingVertical: 8,
      outlineWidth: 0,
    },
    editSend: {
      backgroundColor: accentColor,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    editSendTxt: {
      color: '#060606',
      fontFamily: F.mono,
      fontWeight: '700',
      fontSize: fontSize,
      letterSpacing: 1.5,
    },

    /* ── Calendar nav ── */
    calNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    calArrow: { padding: 4 },
    calArrowTxt: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    calMonthLabel: {
      fontFamily: F.display,
      fontSize: 16,
      color: mc.text,
      letterSpacing: 1,
    },

    /* ── Calendar grid ── */
    gridRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    gridHeaderCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 6,
    },
    gridHeaderTxt: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: `${100 / 7}%`,
      minHeight: 80,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: mc.border,
      padding: 5,
      overflow: 'hidden',
    },
    dayCellFaded: { opacity: 0.35 },
    dayCellRest: { backgroundColor: mc.bg },
    dayCellOptional: { backgroundColor: mc.surface },
    dayCellToday: {
      borderColor: accentColor,
      borderWidth: 1,
    },
    calDayName: {
      fontFamily: F.mono,
      fontSize: 8,
      color: mc.text3,
      letterSpacing: 1,
      marginBottom: 2,
    },
    calDateNum: {
      fontFamily: F.display,
      fontSize: fontSize,
      color: mc.text,
      marginBottom: 3,
    },
    calTodayDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: accentColor,
      marginBottom: 3,
    },
    calExChip: {
      backgroundColor: mc.goldDim,
      paddingHorizontal: 4,
      paddingVertical: 1,
      marginBottom: 2,
      borderRadius: 2,
    },
    calExChipTxt: {
      fontFamily: F.mono,
      fontSize: 9,
      color: accentColor,
      letterSpacing: 0.5,
    },
    calExMeta: {
      fontFamily: F.mono,
      fontSize: 9,
      color: mc.text3,
    },
    calRestLbl: {
      fontFamily: F.mono,
      fontSize: 9,
      color: mc.text3,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    calOptLbl: {
      fontFamily: F.mono,
      fontSize: 9,
      color: mc.text2,
      letterSpacing: 1,
    },

    /* ── Activity density heatmap ── */
    heatmapCard: {
      margin: 16,
      borderWidth: 1,
      borderColor: mc.border,
      padding: 16,
      backgroundColor: mc.surface,
    },
    heatmapLabel: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
      letterSpacing: 1,
      marginBottom: 10,
      textTransform: 'uppercase',
    },
    heatmapCaption: {
      fontFamily: F.mono,
      fontSize: 9,
      color: mc.text3,
      marginTop: 10,
    },

    /* ── Toast ── */
    toast: {
      position: 'absolute',
      bottom: 20,
      left: 16,
      right: 16,
      backgroundColor: mc.elevated,
      borderWidth: 1,
      borderColor: mc.border,
      padding: 12,
      borderRadius: 2,
    },
    toastErr: {
      borderColor: 'rgba(207,102,121,0.5)',
    },
    toastTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text2,
      letterSpacing: 0.5,
    },

    /* ── Modal ── */
    modalBd: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalSheet: {
      width: '100%',
      maxWidth: 520,
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
      maxHeight: '90%',
    },

    /* ── Day view ── */
    dvHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    dvTitle: {
      fontFamily: F.display,
      fontSize: 16,
      color: mc.text,
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    dvBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
    },
    dvBadgeTxt: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    badgeRest:     { borderColor: mc.border,   backgroundColor: mc.bg },
    badgeExercise: { borderColor: accentColor,  backgroundColor: mc.goldDim },
    badgeOpt:      { borderColor: mc.border,    backgroundColor: mc.surface },
    badgeFree:     { borderColor: mc.border,    backgroundColor: mc.bg },

    dvRestMsg: {
      padding: 24,
      alignItems: 'center',
    },
    dvRestTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text3,
      textAlign: 'center',
      lineHeight: 22,
    },
    dvHrLine: {
      position: 'absolute',
      left: 48,
      right: 0,
      height: 1,
      backgroundColor: mc.border,
    },
    dvHrLbl: {
      position: 'absolute',
      left: 4,
      width: 40,
      fontFamily: F.mono,
      fontSize: 9,
      color: mc.text3,
      textAlign: 'right',
    },
    dvMealPill: {
      position: 'absolute',
      right: 4,
      backgroundColor: mc.elevated,
      borderWidth: 1,
      borderColor: mc.border,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 2,
    },
    dvMealTxt: {
      fontFamily: F.mono,
      fontSize: 9,
      color: mc.text3,
      letterSpacing: 0.5,
    },
    dvBlock: {
      position: 'absolute',
      left: 52,
      right: 8,
      backgroundColor: mc.goldDim,
      borderLeftWidth: 3,
      borderLeftColor: accentColor,
      paddingHorizontal: 8,
      paddingTop: 4,
      overflow: 'hidden',
    },
    dvBlockName: {
      fontFamily: F.mono,
      fontSize: 11,
      color: accentColor,
      fontWeight: '700',
      letterSpacing: 0.5,
      outlineWidth: 0,
      borderWidth: 0,
      padding: 0,
    },
    dvBlockTime: {
      fontFamily: F.mono,
      fontSize: 9,
      color: mc.text3,
      marginTop: 2,
    },
    dvBlockDel: {
      position: 'absolute',
      top: 4,
      right: 6,
    },
    dvNowLine: {
      position: 'absolute',
      left: 48,
      right: 0,
      height: 2,
      backgroundColor: C.red,
    },
    dvSectionHead: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },

    /* ── Add block row ── */
    addBlockWrap: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: mc.border,
    },
    addBlockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    addBlockInp: {
      backgroundColor: mc.elevated,
      borderWidth: 1,
      borderColor: mc.border,
      color: mc.text,
      fontFamily: F.mono,
      fontSize: fontSize,
      paddingHorizontal: 10,
      paddingVertical: 7,
      outlineWidth: 0,
    },
    addBlockBtn: {
      width: 36,
      height: 36,
      backgroundColor: accentColor,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

/* ── AddBlockRow ─────────────────────────────────────────────────────────── */
function AddBlockRow({ onAdd }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  const st = makeStyles(mc, accentColor, fontSize, borderRadius);
  const [name,    setName]    = useState('');
  const [startHr, setStartHr] = useState('9');
  const [endHr,   setEndHr]   = useState('10');

  function submit() {
    if (!name.trim()) return;
    const sh = parseFloat(startHr) || 9;
    const eh = parseFloat(endHr)   || sh + 1;
    onAdd({ name: name.trim(), startH: sh, endH: Math.max(sh + 0.25, eh) });
    setName(''); setStartHr('9'); setEndHr('10');
  }

  return (
    <View style={st.addBlockWrap}>
      <Text style={st.dvSectionHead}>Add block</Text>
      <View style={st.addBlockRow}>
        <TextInput
          style={[st.addBlockInp, { flex: 1 }]}
          value={name}
          onChangeText={setName}
          placeholder="Block name"
          placeholderTextColor={mc.text3}
          onSubmitEditing={submit}
          returnKeyType="done"
        />
        <TextInput
          style={[st.addBlockInp, { width: 52 }]}
          value={startHr}
          onChangeText={setStartHr}
          placeholder="9"
          placeholderTextColor={mc.text3}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={[st.addBlockInp, { width: 52 }]}
          value={endHr}
          onChangeText={setEndHr}
          placeholder="10"
          placeholderTextColor={mc.text3}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity style={st.addBlockBtn} onPress={submit}>
          <Text style={{ color: '#060606', fontSize: 18, fontWeight: '700', lineHeight: 22 }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

