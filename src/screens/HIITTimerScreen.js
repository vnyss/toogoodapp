import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser, getToken } from '../auth';
import { API_BASE } from '../config';

const PRESETS = [
  { key: 'tabata',  name: 'Tabata',     work: 20,  rest: 10, rounds: 8,  sets: 1, description: '20s on / 10s off × 8 rounds. Classic HIIT protocol.',
    exercises: ['Burpees', 'Mountain Climbers', 'Jump Squats', 'High Knees'] },
  { key: 'amrap',   name: 'AMRAP 10',   work: 600, rest: 0,  rounds: 1,  sets: 1, description: 'As Many Rounds As Possible in 10 minutes. Your pace.',
    exercises: ['Full Circuit: 10 Push-ups, 15 Squats, 20 Sit-ups'] },
  { key: 'emom10',  name: 'EMOM 10',    work: 40,  rest: 20, rounds: 10, sets: 1, description: 'Every Minute On the Minute for 10 minutes.',
    exercises: ['Kettlebell Swings', 'Box Jumps', 'Push-ups', 'Lunges'] },
  { key: 'emom15',  name: 'EMOM 15',    work: 40,  rest: 20, rounds: 15, sets: 1, description: 'Every Minute On the Minute for 15 minutes.',
    exercises: ['Burpees', 'Air Squats', 'Plank Hold', 'Jumping Jacks'] },
  { key: '3030',    name: '30/30 × 10', work: 30,  rest: 30, rounds: 10, sets: 1, description: '30 seconds work / 30 seconds rest. Steady intensity.',
    exercises: ['Jumping Jacks', 'Squat Jumps', 'Push-ups', 'Plank'] },
  { key: 'pyramid', name: 'Pyramid',    work: 40,  rest: 20, rounds: 8,  sets: 3, description: '3 sets of 8 rounds with a 90s break between sets.',
    exercises: ['Burpees', 'Mountain Climbers', 'Jump Lunges', 'Bicycle Crunches'] },
  { key: 'custom',  name: 'Custom',     work: 30,  rest: 15, rounds: 6,  sets: 1, description: 'Set your own work / rest / rounds.',
    exercises: ['Exercise 1', 'Exercise 2'] },
];

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return m + ':' + String(ss).padStart(2, '0');
}
function fmtStamp(ts) {
  return new Date(ts).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HIITTimerScreen() {
  const { mc, accentColor } = useTheme();
  const [preset,    setPreset]    = useState(PRESETS[0]);
  const [work,      setWork]      = useState(20);
  const [rest,      setRest]      = useState(10);
  const [rounds,    setRounds]    = useState(8);
  const [sets,      setSets]      = useState(1);
  const [exercises, setExercises] = useState(PRESETS[0].exercises);
  const [phase,     setPhase]     = useState('idle');
  const [timeLeft,  setTimeLeft]  = useState(0);
  const [curRound,  setCurRound]  = useState(1);
  const [curSet,    setCurSet]    = useState(1);
  const [elapsed,   setElapsed]   = useState(0);
  const [tab,        setTab]       = useState('workout');
  const [history,    setHistory]   = useState([]);
  const [saved,      setSaved]     = useState([]);
  const [weightKg,   setWeightKg]  = useState(70);
  const [saveName,   setSaveName]  = useState('');
  const timerRef = useRef(null);
  const elRef    = useRef(null);
  const userRef  = useRef(null);

  useEffect(() => {
    (async () => {
      const u = await getUser();
      userRef.current = u;
      const hRaw = await AsyncStorage.getItem('tg_hiit_history_' + u);
      if (hRaw) setHistory(JSON.parse(hRaw));
      const sRaw = await AsyncStorage.getItem('tg_hiit_saved_' + u);
      if (sRaw) setSaved(JSON.parse(sRaw));
      try {
        const token = await getToken();
        const res = await fetch(API_BASE + '/api/v1/me', { headers: { Authorization: 'Bearer ' + token } });
        const d = await res.json();
        const w = d.weight_kg || d.weight || d.current_weight;
        if (w) setWeightKg(parseFloat(w));
      } catch {}
    })();
  }, []);

  function applyPreset(p) {
    setPreset(p);
    setWork(p.work); setRest(p.rest); setRounds(p.rounds); setSets(p.sets);
    setExercises(p.exercises || ['Exercise 1']);
    reset();
  }

  function reset() {
    clearInterval(timerRef.current); clearInterval(elRef.current);
    setPhase('idle'); setCurRound(1); setCurSet(1); setElapsed(0); setTimeLeft(0);
  }

  function start() {
    reset();
    setTimeout(() => {
      setPhase('work');
      setTimeLeft(work);
      setCurRound(1); setCurSet(1); setElapsed(0);
    }, 50);
  }

  useEffect(() => {
    if (phase === 'idle' || phase === 'done') return;
    elRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(elRef.current);
  }, [phase === 'idle' || phase === 'done']);

  useEffect(() => {
    if (phase === 'idle' || phase === 'done') return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          advance();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, curRound, curSet]);

  function advance() {
    setCurRound(r => {
      setCurSet(s => {
        if (phase === 'work') {
          if (rest > 0) { setPhase('rest'); setTimeLeft(rest); return s; }
          return nextRound(r, s);
        } else if (phase === 'rest') {
          return nextRound(r, s);
        } else if (phase === 'setBreak') {
          const nextS = s + 1;
          if (nextS > sets) { finishWorkout(); return s; }
          setPhase('work'); setTimeLeft(work); setCurRound(1);
          return nextS;
        }
        return s;
      });
      return r;
    });
  }

  function nextRound(r, s) {
    const nextR = r + 1;
    if (nextR > rounds) {
      if (sets > 1 && s < sets) { setPhase('setBreak'); setTimeLeft(90); return s; }
      finishWorkout();
      return s;
    }
    setCurRound(nextR);
    setPhase('work');
    setTimeLeft(work);
    return s;
  }

  async function finishWorkout() {
    setPhase('done');
    clearInterval(elRef.current);
    const totalSeconds = elapsed;
    const met = 8; // HIIT average MET
    const kcal = Math.round(met * weightKg * (totalSeconds / 3600));
    const entry = {
      date: Date.now(), protocol: preset.name, duration: totalSeconds,
      rounds: rounds * sets, kcal,
    };
    const hist = [entry, ...history].slice(0, 60);
    setHistory(hist);
    if (userRef.current) await AsyncStorage.setItem('tg_hiit_history_' + userRef.current, JSON.stringify(hist));
  }

  function updateExercise(i, val) {
    const ex = [...exercises]; ex[i] = val; setExercises(ex);
  }
  function addExercise() { setExercises([...exercises, 'New Exercise']); }
  function removeExercise(i) { setExercises(exercises.filter((_, j) => j !== i)); }

  async function saveCustomWorkout() {
    if (!saveName.trim()) return;
    const entry = { name: saveName.trim(), work, rest, rounds, sets, exercises };
    const updated = [entry, ...saved].slice(0, 30);
    setSaved(updated);
    if (userRef.current) await AsyncStorage.setItem('tg_hiit_saved_' + userRef.current, JSON.stringify(updated));
    setSaveName('');
  }
  async function deleteSaved(name) {
    const updated = saved.filter(w => w.name !== name);
    setSaved(updated);
    if (userRef.current) await AsyncStorage.setItem('tg_hiit_saved_' + userRef.current, JSON.stringify(updated));
  }
  function loadSaved(w) {
    setPreset({ key: 'custom', name: w.name, work: w.work, rest: w.rest, rounds: w.rounds, sets: w.sets, description: 'Saved workout', exercises: w.exercises });
    setWork(w.work); setRest(w.rest); setRounds(w.rounds); setSets(w.sets); setExercises(w.exercises);
    setTab('workout');
    reset();
  }

  const totalRounds = rounds * sets;
  const doneRounds  = (curSet - 1) * rounds + (curRound - 1);
  const overallPct  = totalRounds > 0 ? doneRounds / totalRounds : 0;
  const phaseLen    = phase === 'work' ? work : phase === 'rest' ? rest : phase === 'setBreak' ? 90 : 1;
  const phasePct    = phaseLen > 0 ? timeLeft / phaseLen : 0;

  const phaseColor  = phase === 'work' ? accentColor : phase === 'rest' ? '#FFB74D' : phase === 'setBreak' ? '#7C8BF5' : mc.text3;
  const phaseLabel  = phase === 'work' ? 'WORK' : phase === 'rest' ? 'REST' : phase === 'setBreak' ? 'SET BREAK' : phase === 'done' ? 'DONE' : 'READY';
  const currentExercise = exercises.length ? exercises[(curRound - 1) % exercises.length] : '';

  const liveKcal = Math.round(8 * weightKg * (elapsed / 3600));

  const R = 90, C = 110;
  const circ = 2 * Math.PI * R;
  const dash  = circ * phasePct;

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 16, maxWidth: 560, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 16 },
    tabs:    { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
    tabBtn:  { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    tabA:    { borderColor: accentColor, backgroundColor: accentColor + '18' },
    tabTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    tabTxA:  { color: accentColor },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 8 },
    row:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
    chip:    { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: mc.border },
    chipA:   { borderColor: accentColor, backgroundColor: accentColor + '18' },
    chipTxt: { fontFamily: F.mono, fontSize: 10, color: mc.text3 },
    chipTxA: { color: accentColor },
    desc:    { fontFamily: F.mono, fontSize: 11, color: mc.text3, lineHeight: 18, marginBottom: 16 },
    fieldRow:{ flexDirection: 'row', gap: 10, marginBottom: 14 },
    field:   { flex: 1 },
    flabel:  { fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 4 },
    input:   { borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, fontSize: 15, color: mc.text },
    startBtn:{ backgroundColor: accentColor, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
    startTxt:{ fontFamily: F.mono, fontSize: 13, color: '#0A0A0A', fontWeight: '700', letterSpacing: 1 },
    resetBtn:{ borderWidth: 1, borderColor: mc.border, paddingVertical: 14, alignItems: 'center' },
    resetTxt:{ fontFamily: F.mono, fontSize: 12, color: mc.text3 },
    ring:    { alignItems: 'center', marginVertical: 16 },
    progBar: { height: 4, backgroundColor: mc.border, borderRadius: 2, marginBottom: 16 },
    progFill:{ height: 4, borderRadius: 2 },
    statRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
    statVal: { fontFamily: F.mono, fontSize: 22, fontWeight: '700', textAlign: 'center' },
    statLbl: { fontFamily: F.mono, fontSize: 9, color: mc.text3, textAlign: 'center', letterSpacing: 1 },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 },
  });

  const isActive = phase !== 'idle' && phase !== 'done';

  const TABS = [
    { k: 'workout', l: 'Workout' },
    { k: 'library', l: 'Saved Workouts' },
    { k: 'history', l: 'History' },
  ];

  return (
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>HIIT Timer</Text>
        <Text style={s.sub}>INTERVAL TRAINING</Text>

        <View style={s.tabs}>
          {TABS.map(t => (
            <TouchableOpacity key={t.k} style={[s.tabBtn, tab === t.k && s.tabA]} onPress={() => setTab(t.k)}>
              <Text style={[s.tabTxt, tab === t.k && s.tabTxA]}>{t.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'workout' && (
          <>
            {/* Preset chips */}
            <Text style={s.label}>PROTOCOL</Text>
            <View style={s.row}>
              {PRESETS.map(p => (
                <TouchableOpacity key={p.key} style={[s.chip, preset.key === p.key && s.chipA]} onPress={() => applyPreset(p)} disabled={isActive}>
                  <Text style={[s.chipTxt, preset.key === p.key && s.chipTxA]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.desc}>{preset.description}</Text>

            {/* Config fields */}
            {!isActive && phase !== 'done' && (
              <>
                <View style={s.fieldRow}>
                  <View style={s.field}>
                    <Text style={s.flabel}>WORK (s)</Text>
                    <TextInput style={s.input} value={String(work)} onChangeText={v => setWork(Math.max(5, parseInt(v)||20))} keyboardType="number-pad" />
                  </View>
                  <View style={s.field}>
                    <Text style={s.flabel}>REST (s)</Text>
                    <TextInput style={s.input} value={String(rest)} onChangeText={v => setRest(Math.max(0, parseInt(v)||10))} keyboardType="number-pad" />
                  </View>
                  <View style={s.field}>
                    <Text style={s.flabel}>ROUNDS</Text>
                    <TextInput style={s.input} value={String(rounds)} onChangeText={v => setRounds(Math.max(1, parseInt(v)||8))} keyboardType="number-pad" />
                  </View>
                  <View style={s.field}>
                    <Text style={s.flabel}>SETS</Text>
                    <TextInput style={s.input} value={String(sets)} onChangeText={v => setSets(Math.max(1, parseInt(v)||1))} keyboardType="number-pad" />
                  </View>
                </View>

                {/* Exercises list */}
                <View style={[s.card, { marginBottom: 16 }]}>
                  <Text style={s.label}>EXERCISES (cycles through rounds)</Text>
                  {exercises.map((ex, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, width: 18 }}>{i+1}.</Text>
                      <TextInput style={[s.input, { flex: 1, fontSize: 12 }]} value={ex} onChangeText={v => updateExercise(i, v)} />
                      {exercises.length > 1 && (
                        <TouchableOpacity onPress={() => removeExercise(i)} style={{ padding: 4 }}>
                          <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#C85A6E" strokeWidth={2.2} strokeLinecap="round">
                            <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
                          </Svg>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  <TouchableOpacity onPress={addExercise} style={{ borderWidth: 1, borderColor: accentColor + '55', paddingVertical: 8, alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor }}>+ Add exercise</Text>
                  </TouchableOpacity>
                </View>

                {/* Save as custom workout */}
                <View style={[s.card, { marginBottom: 16 }]}>
                  <Text style={s.label}>SAVE THIS WORKOUT</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[s.input, { flex: 1 }]} value={saveName} onChangeText={setSaveName} placeholder="Workout name" placeholderTextColor={mc.text3} />
                    <TouchableOpacity onPress={saveCustomWorkout} style={{ borderWidth: 1, borderColor: accentColor, paddingHorizontal: 14, justifyContent: 'center' }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor }}>SAVE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* SVG ring timer */}
            {isActive || phase === 'done' ? (
              <>
                <View style={s.ring}>
                  <Svg width={220} height={220} viewBox="0 0 220 220">
                    <Circle cx={C} cy={C} r={R} fill="none" stroke={mc.border} strokeWidth={8} />
                    {phase !== 'done' && (
                      <Circle cx={C} cy={C} r={R} fill="none" stroke={phaseColor} strokeWidth={8}
                        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${C} ${C})`} />
                    )}
                    <SvgText x={C} y={C - 14} textAnchor="middle" fontSize={10} fill={phaseColor} letterSpacing={2}>{phaseLabel}</SvgText>
                    <SvgText x={C} y={C + 24} textAnchor="middle" fontSize={44} fontWeight="700" fill={phaseColor}>
                      {phase === 'done' ? 'DONE' : fmtTime(timeLeft)}
                    </SvgText>
                  </Svg>
                </View>

                {/* Current exercise card */}
                {phase === 'work' && currentExercise && (
                  <View style={[s.card, { backgroundColor: accentColor + '12', borderColor: accentColor + '55', alignItems: 'center', marginBottom: 16 }]}>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: accentColor, letterSpacing: 2, marginBottom: 4 }}>DO NOW</Text>
                    <Text style={{ fontFamily: F.serif, fontSize: 18, color: mc.text }}>{currentExercise}</Text>
                  </View>
                )}
                {phase === 'rest' && exercises.length > 0 && (
                  <View style={[s.card, { alignItems: 'center', marginBottom: 16 }]}>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: '#FFB74D', letterSpacing: 2, marginBottom: 4 }}>UP NEXT</Text>
                    <Text style={{ fontFamily: F.serif, fontSize: 16, color: mc.text }}>{exercises[curRound % exercises.length]}</Text>
                  </View>
                )}

                <View style={s.statRow}>
                  <View>
                    <Text style={[s.statVal, { color: accentColor }]}>{curRound}</Text>
                    <Text style={s.statLbl}>ROUND</Text>
                  </View>
                  <View>
                    <Text style={[s.statVal, { color: mc.text }]}>/ {rounds}</Text>
                    <Text style={s.statLbl}>TOTAL</Text>
                  </View>
                  {sets > 1 && (
                    <View>
                      <Text style={[s.statVal, { color: '#7C8BF5' }]}>{curSet}/{sets}</Text>
                      <Text style={s.statLbl}>SET</Text>
                    </View>
                  )}
                  <View>
                    <Text style={[s.statVal, { color: mc.text3 }]}>{fmtTime(elapsed)}</Text>
                    <Text style={s.statLbl}>ELAPSED</Text>
                  </View>
                  <View>
                    <Text style={[s.statVal, { color: '#FF8A65' }]}>{liveKcal}</Text>
                    <Text style={s.statLbl}>KCAL</Text>
                  </View>
                </View>

                <View style={s.progBar}>
                  <View style={[s.progFill, { width: `${overallPct * 100}%`, backgroundColor: accentColor }]} />
                </View>
                {phase === 'done' && (
                  <View style={[s.card, { alignItems: 'center', marginBottom: 16, borderColor: '#4CAF7C44', backgroundColor: '#4CAF7C0c' }]}>
                    <Text style={{ fontFamily: F.serif, fontSize: 16, color: '#4CAF7C', marginBottom: 4 }}>Workout Complete!</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>
                      {totalRounds} rounds · {fmtTime(elapsed)} · ~{liveKcal} kcal burned
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={[s.card, { marginBottom: 16 }]}>
                <Text style={s.label}>PREVIEW</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>
                  {work}s work / {rest}s rest × {rounds} rounds{sets > 1 ? ` × ${sets} sets` : ''}
                </Text>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginTop: 6 }}>
                  Total time: ~{fmtTime((work + rest) * rounds * sets + (sets > 1 ? 90 * (sets - 1) : 0))}
                  {' · '}~{Math.round(8 * weightKg * (((work + rest) * rounds * sets) / 3600))} kcal estimated
                </Text>
              </View>
            )}

            <TouchableOpacity style={s.startBtn} onPress={isActive ? reset : start}>
              <Text style={s.startTxt}>{isActive ? 'STOP' : phase === 'done' ? 'RESTART' : 'START'}</Text>
            </TouchableOpacity>
            {isActive && (
              <TouchableOpacity style={s.resetBtn} onPress={reset}>
                <Text style={s.resetTxt}>Reset</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {tab === 'library' && (
          <View>
            {saved.length === 0 ? (
              <View style={s.card}>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>
                  No saved workouts yet. Build one in the Workout tab and tap SAVE.
                </Text>
              </View>
            ) : saved.map((w, i) => (
              <View key={i} style={s.card}>
                <Text style={{ fontFamily: F.mono, fontSize: 14, color: mc.text, marginBottom: 4 }}>{w.name}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 8 }}>
                  {w.work}s/{w.rest}s × {w.rounds} rounds{w.sets > 1 ? ` × ${w.sets} sets` : ''} · {w.exercises.length} exercises
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => loadSaved(w)} style={{ borderWidth: 1, borderColor: accentColor, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor }}>Load</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteSaved(w.name)} style={{ borderWidth: 1, borderColor: '#E5737355', paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: '#E57373' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {tab === 'history' && (
          <View>
            {history.length > 0 && (
              <View style={s.card}>
                <Text style={s.label}>ALL-TIME STATS</Text>
                <View style={s.statRow}>
                  <View>
                    <Text style={[s.statVal, { color: accentColor }]}>{history.length}</Text>
                    <Text style={s.statLbl}>WORKOUTS</Text>
                  </View>
                  <View>
                    <Text style={[s.statVal, { color: '#FF8A65' }]}>{history.reduce((sum, h) => sum + h.kcal, 0)}</Text>
                    <Text style={s.statLbl}>TOTAL KCAL</Text>
                  </View>
                  <View>
                    <Text style={[s.statVal, { color: '#7C8BF5' }]}>{Math.round(history.reduce((sum, h) => sum + h.duration, 0) / 60)}</Text>
                    <Text style={s.statLbl}>TOTAL MIN</Text>
                  </View>
                </View>
              </View>
            )}
            <View style={s.card}>
              <Text style={s.label}>SESSION LOG</Text>
              {history.length === 0 ? (
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>No completed workouts yet.</Text>
              ) : history.map((h, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: mc.border }}>
                  <View>
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{h.protocol}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{fmtStamp(h.date)} · {h.rounds} rounds</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 13, color: accentColor, fontWeight: '700' }}>{fmtTime(h.duration)}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: '#FF8A65' }}>{h.kcal} kcal</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
