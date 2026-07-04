import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';
import { GUIDED_WORKOUTS, DIFFICULTIES, FOCUSES } from '../data/guidedWorkouts';
import { EXERCISES } from '../data/exercises';

const HOME_WORKOUTS = GUIDED_WORKOUTS.filter(w => w.collection === 'No Equipment');
const BODYWEIGHT_EXERCISES = EXERCISES.filter(e => e.equipment === 'Bodyweight');

function FilterChip({ label, active, onPress }) {
  const { mc, accentColor } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: active ? accentColor : mc.border, backgroundColor: active ? accentColor + '18' : 'transparent', marginRight: 6, marginBottom: 6 }}
    >
      <Text style={{ fontFamily: F.mono, fontSize: 10, color: active ? accentColor : mc.text3 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function WorkoutCard({ w, onPress }) {
  const { mc, accentColor } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={{ borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ backgroundColor: accentColor + '18', borderWidth: 1, borderColor: accentColor + '44', paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 9, color: accentColor }}>NO EQUIPMENT</Text>
        </View>
        <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{w.difficulty}</Text>
      </View>
      <Text style={{ fontFamily: F.mono, fontSize: 14, color: mc.text, marginBottom: 6 }}>{w.name}</Text>
      <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>
        {w.duration} min  ·  {w.exercises.length} exercises  ·  {w.focus.join(', ')}
      </Text>
    </TouchableOpacity>
  );
}

// ── PLAYER (same mechanics as Guided Workouts) ──
function WorkoutPlayer({ workout, onDone, onExit }) {
  const { mc, accentColor } = useTheme();
  const [exIdx,    setExIdx]    = useState(0);
  const [timeLeft, setTimeLeft] = useState(workout.exercises[0].duration);
  const [isRest,   setIsRest]   = useState(false);
  const [paused,   setPaused]   = useState(false);
  const [done,     setDone]     = useState(false);
  const [elapsed,  setElapsed]  = useState(0);
  const timerRef = useRef(null);
  const elRef    = useRef(null);

  const ex      = workout.exercises[exIdx];
  const nextEx  = workout.exercises[exIdx + 1];
  const totalEx = workout.exercises.length;
  const progress = (exIdx + (isRest ? 0.5 : 0)) / totalEx;

  useEffect(() => {
    elRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { clearInterval(elRef.current); clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (paused || done) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); advance(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [exIdx, isRest, paused, done]);

  function advance() {
    const cur = workout.exercises[exIdx];
    if (!isRest && cur.restAfter > 0) {
      setIsRest(true);
      setTimeLeft(cur.restAfter);
    } else {
      const next = exIdx + 1;
      if (next >= workout.exercises.length) {
        setDone(true);
        clearInterval(elRef.current);
        onDone && onDone({ elapsed });
      } else {
        setExIdx(next);
        setIsRest(false);
        setTimeLeft(workout.exercises[next].duration);
      }
    }
  }

  function skip() { clearInterval(timerRef.current); advance(); }

  function fmtTime(s) {
    const m = Math.floor(s / 60), ss = s % 60;
    return `${m}:${ss.toString().padStart(2, '0')}`;
  }

  const circleR = 80, circleC = 100;
  const circleMax = !isRest ? ex.duration : ex.restAfter;
  const pct = circleMax > 0 ? timeLeft / circleMax : 0;
  const circumference = 2 * Math.PI * circleR;
  const strokeDash = circumference * pct;
  const ringColor = isRest ? '#FFB74D' : accentColor;

  const ps = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg, alignItems: 'center', justifyContent: 'space-between', padding: 24, paddingTop: 48 },
    phase:   { fontFamily: F.mono, fontSize: 11, color: isRest ? '#FFB74D' : accentColor, letterSpacing: 2, marginBottom: 8 },
    exName:  { fontFamily: F.serif, fontSize: 28, color: mc.text, textAlign: 'center', marginBottom: 8, lineHeight: 36 },
    tips:    { fontFamily: F.mono, fontSize: 11, color: mc.text3, textAlign: 'center', lineHeight: 18, maxWidth: 300, marginBottom: 24 },
    next:    { fontFamily: F.mono, fontSize: 11, color: mc.text3, textAlign: 'center', marginTop: 10 },
    prog:    { fontFamily: F.mono, fontSize: 11, color: mc.text3, textAlign: 'center', marginBottom: 8 },
    row:     { flexDirection: 'row', gap: 14 },
    btn:     { flex: 1, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: mc.border },
    primary: { backgroundColor: accentColor, borderColor: accentColor },
    btnTxt:  { fontFamily: F.mono, fontSize: 12, color: mc.text3 },
    btnPTxt: { color: '#0A0A0A', fontWeight: '700' },
    progBar: { width: '100%', height: 4, backgroundColor: mc.border, borderRadius: 2, marginBottom: 24 },
    progFill:{ height: 4, backgroundColor: accentColor, borderRadius: 2 },
    exitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16 },
    exitTxt: { fontFamily: F.mono, fontSize: 11, color: mc.text3, letterSpacing: 1 },
  });

  if (done) {
    return (
      <View style={[ps.root, { justifyContent: 'center' }]}>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor, letterSpacing: 2, marginBottom: 16 }}>WORKOUT COMPLETE</Text>
        <Text style={{ fontFamily: F.serif, fontSize: 32, color: mc.text, marginBottom: 8 }}>Well done!</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 14, color: mc.text3, marginBottom: 40 }}>{fmtTime(elapsed)} · {totalEx} exercises</Text>
        <TouchableOpacity style={[ps.btn, ps.primary, { width: '100%' }]} onPress={onExit}>
          <Text style={[ps.btnTxt, ps.btnPTxt]}>FINISH</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={ps.root}>
      <TouchableOpacity style={ps.exitBtn} onPress={onExit}>
        <Svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2.2} strokeLinecap="round">
          <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
        </Svg>
        <Text style={ps.exitTxt}>Exit</Text>
      </TouchableOpacity>
      <View style={{ alignItems: 'center' }}>
        <Svg width={200} height={200} viewBox="0 0 200 200">
          <Circle cx={circleC} cy={circleC} r={circleR} fill="none" stroke={mc.border} strokeWidth={6} />
          <Circle cx={circleC} cy={circleC} r={circleR} fill="none" stroke={ringColor} strokeWidth={6}
            strokeDasharray={`${strokeDash} ${circumference}`} strokeLinecap="round" transform={`rotate(-90 ${circleC} ${circleC})`} />
          <SvgText x={circleC} y={circleC + 20} textAnchor="middle" fontSize={40} fontWeight="700" fill={ringColor}>{fmtTime(timeLeft)}</SvgText>
        </Svg>
        <Text style={ps.phase}>{isRest ? '— REST —' : `EXERCISE ${exIdx + 1} OF ${totalEx}`}</Text>
        <Text style={ps.exName}>{isRest ? 'Rest' : ex.name}</Text>
        {!isRest && <Text style={ps.tips}>{ex.tips}</Text>}
        {nextEx && <Text style={ps.next}>Up next: {nextEx.name}</Text>}
      </View>
      <View style={{ width: '100%' }}>
        <View style={ps.progBar}><View style={[ps.progFill, { width: `${progress * 100}%` }]} /></View>
        <Text style={ps.prog}>{fmtTime(elapsed)} elapsed</Text>
        <View style={ps.row}>
          <TouchableOpacity style={ps.btn} onPress={() => setPaused(p => !p)}>
            <Text style={ps.btnTxt}>{paused ? 'RESUME' : 'PAUSE'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ps.btn, ps.primary]} onPress={skip}>
            <Text style={[ps.btnTxt, ps.btnPTxt]}>SKIP →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── MAIN SCREEN ──
export default function HomeWorkoutScreen() {
  const { mc, accentColor } = useTheme();
  const [view,       setView]       = useState('browse'); // browse | exercises | detail | player | done
  const [selected,   setSelected]   = useState(null);
  const [diff,       setDiff]       = useState('All');
  const [focus,      setFocus]      = useState('All');
  const [search,     setSearch]     = useState('');
  const [history,    setHistory]    = useState([]);
  const [storageKey, setStorageKey] = useState(null);

  useEffect(() => {
    getUser().then(async u => {
      const key = `tg_home_workout_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) setHistory(JSON.parse(raw));
    });
  }, []);

  async function handleDone({ elapsed }) {
    const entry = { id: selected.id, name: selected.name, date: new Date().toISOString().slice(0, 10), elapsed };
    const updated = [entry, ...history].slice(0, 50);
    setHistory(updated);
    if (storageKey) await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    setView('done');
  }

  const filtered = HOME_WORKOUTS.filter(w =>
    (diff  === 'All' || w.difficulty === diff) &&
    (focus === 'All' || w.focus.includes(focus)) &&
    (search === '' || w.name.toLowerCase().includes(search.toLowerCase()))
  );

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 16, maxWidth: 680, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 16 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 6 },
    input:   { borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, fontSize: 13, color: mc.text, marginBottom: 10 },
    row:     { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
    backBtn: { paddingVertical: 10, marginBottom: 16 },
    backTxt: { fontFamily: F.mono, fontSize: 12, color: accentColor },
    startBtn:{ backgroundColor: accentColor, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
    startTxt:{ fontFamily: F.mono, fontSize: 13, color: '#0A0A0A', fontWeight: '700', letterSpacing: 1 },
    tabs:    { flexDirection: 'row', gap: 6, marginBottom: 18 },
    tab:     { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    tabA:    { borderColor: accentColor, backgroundColor: accentColor + '18' },
    tabTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    tabTxA:  { color: accentColor },
    exCard:  { borderWidth: 1, borderColor: mc.border, padding: 14, marginBottom: 8 },
  });

  if (view === 'player') {
    return <WorkoutPlayer workout={selected} onDone={handleDone} onExit={() => setView('detail')} />;
  }

  if (view === 'done') {
    return (
      <View style={{ flex: 1, backgroundColor: mc.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor, letterSpacing: 2, marginBottom: 16 }}>COMPLETED</Text>
        <Text style={{ fontFamily: F.serif, fontSize: 28, color: mc.text, textAlign: 'center', marginBottom: 8 }}>{selected?.name}</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3, marginBottom: 32 }}>No equipment needed — logged to your history.</Text>
        <TouchableOpacity style={{ backgroundColor: accentColor, paddingHorizontal: 40, paddingVertical: 16 }} onPress={() => setView('browse')}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700' }}>DONE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (view === 'detail' && selected) {
    return (
      <ScrollView style={s.root}>
        <View style={s.content}>
          <TouchableOpacity style={s.backBtn} onPress={() => setView('browse')}><Text style={s.backTxt}>← All home workouts</Text></TouchableOpacity>
          <View style={{ backgroundColor: accentColor + '18', borderWidth: 1, borderColor: accentColor + '44', paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 9, color: accentColor }}>NO EQUIPMENT</Text>
          </View>
          <Text style={s.title}>{selected.name}</Text>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 20 }}>
            {selected.difficulty}  ·  {selected.duration} min  ·  {selected.focus.join(', ')}
          </Text>
          <View style={{ borderWidth: 1, borderColor: mc.border, padding: 14, marginBottom: 14 }}>
            <Text style={s.label}>EXERCISES ({selected.exercises.length})</Text>
            {selected.exercises.map((ex, i) => (
              <View key={i} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: i < selected.exercises.length - 1 ? 1 : 0, borderBottomColor: mc.border }}>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, width: 24 }}>{i + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, marginBottom: 2 }}>{ex.name}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{ex.duration}s work{ex.restAfter > 0 ? ` · ${ex.restAfter}s rest` : ''}</Text>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.startBtn} onPress={() => setView('player')}><Text style={s.startTxt}>START WORKOUT</Text></TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.root} keyboardShouldPersistTaps="handled">
      <View style={s.content}>
        <Text style={s.title}>Home Workout</Text>
        <Text style={s.sub}>NO EQUIPMENT NEEDED — TRAIN ANYWHERE</Text>

        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, view === 'browse' && s.tabA]} onPress={() => setView('browse')}>
            <Text style={[s.tabTxt, view === 'browse' && s.tabTxA]}>Guided Routines</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, view === 'exercises' && s.tabA]} onPress={() => setView('exercises')}>
            <Text style={[s.tabTxt, view === 'exercises' && s.tabTxA]}>Exercise Library</Text>
          </TouchableOpacity>
        </View>

        {view === 'browse' && (
          <>
            <TextInput style={s.input} value={search} onChangeText={setSearch} placeholder="Search routines…" placeholderTextColor={mc.text3} />

            <Text style={s.label}>DIFFICULTY</Text>
            <View style={s.row}>
              {DIFFICULTIES.map(d => <FilterChip key={d} label={d} active={diff === d} onPress={() => setDiff(d)} />)}
            </View>

            <Text style={s.label}>FOCUS AREA</Text>
            <View style={s.row}>
              {FOCUSES.map(f => <FilterChip key={f} label={f} active={focus === f} onPress={() => setFocus(f)} />)}
            </View>

            <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 14 }}>
              {filtered.length} routine{filtered.length !== 1 ? 's' : ''} · no equipment required
            </Text>

            {filtered.map(w => (
              <WorkoutCard key={w.id} w={w} onPress={() => { setSelected(w); setView('detail'); }} />
            ))}

            {history.length > 0 && (
              <>
                <Text style={[s.label, { marginTop: 20 }]}>RECENT HOME WORKOUTS</Text>
                {history.slice(0, 5).map((h, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: mc.border }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{h.name}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>{h.date}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {view === 'exercises' && (
          <>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 14 }}>
              {BODYWEIGHT_EXERCISES.length} bodyweight exercises — browse for reference or to build your own routine in Workout Tracker.
            </Text>
            {BODYWEIGHT_EXERCISES.map(e => (
              <View key={e.id} style={s.exCard}>
                <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text, marginBottom: 4 }}>{e.name}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{(e.muscles || []).join(', ')}{e.category ? ` · ${e.category}` : ''}</Text>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}
