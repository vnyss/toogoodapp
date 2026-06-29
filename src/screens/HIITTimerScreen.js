import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';

const PRESETS = [
  { key: 'tabata',  name: 'Tabata',         work: 20, rest: 10, rounds: 8,  sets: 1, description: '20s on / 10s off × 8 rounds. Classic HIIT protocol.' },
  { key: 'amrap',   name: 'AMRAP 10',       work: 600,rest: 0,  rounds: 1,  sets: 1, description: 'As Many Rounds As Possible in 10 minutes. Your pace.' },
  { key: 'emom10',  name: 'EMOM 10',        work: 40, rest: 20, rounds: 10, sets: 1, description: 'Every Minute On the Minute for 10 minutes.' },
  { key: 'emom15',  name: 'EMOM 15',        work: 40, rest: 20, rounds: 15, sets: 1, description: 'Every Minute On the Minute for 15 minutes.' },
  { key: '3030',    name: '30/30 × 10',     work: 30, rest: 30, rounds: 10, sets: 1, description: '30 seconds work / 30 seconds rest. Steady intensity.' },
  { key: 'pyramid', name: 'Pyramid',        work: 40, rest: 20, rounds: 8,  sets: 3, description: '3 sets of 8 rounds with a 90s break between sets.' },
  { key: 'custom',  name: 'Custom',         work: 30, rest: 15, rounds: 6,  sets: 1, description: 'Set your own work / rest / rounds.' },
];

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

export default function HIITTimerScreen() {
  const { mc, accentColor } = useTheme();
  const [preset,    setPreset]    = useState(PRESETS[0]);
  const [work,      setWork]      = useState(20);
  const [rest,      setRest]      = useState(10);
  const [rounds,    setRounds]    = useState(8);
  const [sets,      setSets]      = useState(1);
  const [phase,     setPhase]     = useState('idle'); // idle | work | rest | setBreak | done
  const [timeLeft,  setTimeLeft]  = useState(0);
  const [curRound,  setCurRound]  = useState(1);
  const [curSet,    setCurSet]    = useState(1);
  const [elapsed,   setElapsed]   = useState(0);
  const timerRef = useRef(null);
  const elRef    = useRef(null);

  function applyPreset(p) {
    setPreset(p);
    setWork(p.work); setRest(p.rest); setRounds(p.rounds); setSets(p.sets);
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

  // elapsed counter
  useEffect(() => {
    if (phase === 'idle' || phase === 'done') return;
    elRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(elRef.current);
  }, [phase === 'idle' || phase === 'done']);

  // main timer
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
          if (rest > 0) {
            setPhase('rest');
            setTimeLeft(rest);
            return s;
          } else {
            return nextRound(r, s);
          }
        } else if (phase === 'rest') {
          return nextRound(r, s);
        } else if (phase === 'setBreak') {
          const nextS = s + 1;
          if (nextS > sets) { setPhase('done'); return s; }
          setPhase('work');
          setTimeLeft(work);
          setCurRound(1);
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
      if (sets > 1 && s < sets) {
        setPhase('setBreak');
        setTimeLeft(90);
        return s;
      }
      setPhase('done');
      clearInterval(elRef.current);
      return s;
    }
    setCurRound(nextR);
    setPhase('work');
    setTimeLeft(work);
    return s;
  }

  const totalRounds = rounds * sets;
  const doneRounds  = (curSet - 1) * rounds + (curRound - 1);
  const overallPct  = totalRounds > 0 ? doneRounds / totalRounds : 0;
  const phaseLen    = phase === 'work' ? work : phase === 'rest' ? rest : phase === 'setBreak' ? 90 : 1;
  const phasePct    = phaseLen > 0 ? timeLeft / phaseLen : 0;

  const phaseColor  = phase === 'work' ? accentColor : phase === 'rest' ? '#FFB74D' : phase === 'setBreak' ? '#7C8BF5' : mc.text3;
  const phaseLabel  = phase === 'work' ? 'WORK' : phase === 'rest' ? 'REST' : phase === 'setBreak' ? 'SET BREAK' : phase === 'done' ? 'DONE' : 'READY';

  // SVG ring
  const R = 90, C = 110;
  const circ = 2 * Math.PI * R;
  const dash  = circ * phasePct;

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 16, maxWidth: 560, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
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
  });

  const isActive = phase !== 'idle' && phase !== 'done';

  return (
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>HIIT Timer</Text>
        <Text style={s.sub}>INTERVAL TRAINING</Text>

        {/* Preset chips */}
        <Text style={s.label}>PROTOCOL</Text>
        <View style={s.row}>
          {PRESETS.map(p => (
            <TouchableOpacity key={p.key} style={[s.chip, preset.key === p.key && s.chipA]} onPress={() => applyPreset(p)}>
              <Text style={[s.chipTxt, preset.key === p.key && s.chipTxA]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.desc}>{preset.description}</Text>

        {/* Config fields */}
        {!isActive && (
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
            {sets > 1 && (
              <View style={s.field}>
                <Text style={s.flabel}>SETS</Text>
                <TextInput style={s.input} value={String(sets)} onChangeText={v => setSets(Math.max(1, parseInt(v)||1))} keyboardType="number-pad" />
              </View>
            )}
          </View>
        )}

        {/* SVG ring timer */}
        {isActive || phase === 'done' ? (
          <>
            <View style={s.ring}>
              {React.createElement(
                require('react-native-svg').default,
                { width: 220, height: 220, viewBox: '0 0 220 220' },
                React.createElement('circle', { cx: C, cy: C, r: R, fill: 'none', stroke: mc.border, strokeWidth: 8 }),
                phase !== 'done' && React.createElement('circle', {
                  cx: C, cy: C, r: R, fill: 'none',
                  stroke: phaseColor, strokeWidth: 8,
                  strokeDasharray: `${dash} ${circ}`,
                  strokeLinecap: 'round',
                  transform: `rotate(-90 ${C} ${C})`,
                }),
                React.createElement(require('react-native-svg').Text, {
                  x: C, y: C - 14, textAnchor: 'middle', fontSize: 10, fill: phaseColor, letterSpacing: 2,
                }, phaseLabel),
                React.createElement(require('react-native-svg').Text, {
                  x: C, y: C + 24, textAnchor: 'middle', fontSize: 44, fontWeight: '700', fill: phaseColor,
                }, phase === 'done' ? '✓' : fmtTime(timeLeft))
              )}
            </View>

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
            </View>

            <View style={s.progBar}>
              <View style={[s.progFill, { width: `${overallPct * 100}%`, backgroundColor: accentColor }]} />
            </View>
            {phase === 'done'
              ? <Text style={{ fontFamily: F.mono, fontSize: 12, color: accentColor, textAlign: 'center', marginBottom: 16 }}>
                  {totalRounds} rounds · {fmtTime(elapsed)} · Well done!
                </Text>
              : null
            }
          </>
        ) : (
          <View style={{ borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 16 }}>
            <Text style={s.label}>PREVIEW</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>
              {work}s work / {rest}s rest × {rounds} rounds{sets > 1 ? ` × ${sets} sets` : ''}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginTop: 6 }}>
              Total time: ~{fmtTime((work + rest) * rounds * sets + (sets > 1 ? 90 * (sets - 1) : 0))}
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
      </View>
    </ScrollView>
  );
}
