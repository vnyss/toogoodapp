import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Modal, ActivityIndicator,
} from 'react-native';
import Svg, { Path, Line, Polyline } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';
import { EXERCISES } from '../data/exercises';
import GymOnboardingModal from '../components/GymOnboardingModal';

// ── helpers ──────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  return new Date(iso + 'T12:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
function calcVolume(exercises) {
  return exercises.reduce((tot, ex) =>
    tot + (ex.sets || []).filter(s => s.done).reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0), 0);
}
function estimated1RM(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}
function fmtDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2,'0')}m`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function WorkoutScreen() {
  const { mc, accentColor } = useTheme();
  const [mode,         setMode]         = useState('home');   // 'home'|'active'|'history'|'templates'
  const [workouts,     setWorkouts]     = useState([]);
  const [templates,    setTemplates]    = useState([]);
  const [prs,          setPrs]          = useState({});       // exerciseId → {weight,reps,date,e1rm}
  const [storageKey,   setStorageKey]   = useState(null);
  // Active workout state
  const [workout,      setWorkout]      = useState(null);     // {name, startTime, exercises:[{id,name,sets:[{weight,reps,done}]}]}
  const [elapsed,      setElapsed]      = useState(0);
  const [restTimer,    setRestTimer]    = useState(0);        // seconds remaining
  const [restRunning,  setRestRunning]  = useState(false);
  const [restSecs,     setRestSecs]     = useState(90);       // default rest
  const [showExPicker, setShowExPicker] = useState(false);
  const [exSearch,     setExSearch]     = useState('');
  const [exMuscle,     setExMuscle]     = useState('All');
  const [showSaveTmpl, setShowSaveTmpl] = useState(false);
  const [tmplName,     setTmplName]     = useState('');
  const [newPRs,       setNewPRs]       = useState([]);       // exercises that hit new PR this session
  const elapsedRef = useRef(null);
  const restRef    = useRef(null);

  useEffect(() => {
    getUser().then(async u => {
      const key = `tg_gym_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.workouts)   setWorkouts(d.workouts);
      if (d.templates)  setTemplates(d.templates);
      if (d.prs)        setPrs(d.prs);
    });
    return () => { clearInterval(elapsedRef.current); clearInterval(restRef.current); };
  }, []);

  async function persist(patch) {
    if (!storageKey) return;
    const d = { workouts, templates, prs, ...patch };
    await AsyncStorage.setItem(storageKey, JSON.stringify(d));
  }

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  function startElapsed() {
    clearInterval(elapsedRef.current);
    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }

  // ── Rest timer ────────────────────────────────────────────────────────────
  function startRest(secs) {
    clearInterval(restRef.current);
    setRestTimer(secs || restSecs);
    setRestRunning(true);
    restRef.current = setInterval(() => {
      setRestTimer(t => {
        if (t <= 1) { clearInterval(restRef.current); setRestRunning(false); return 0; }
        return t - 1;
      });
    }, 1000);
  }
  function stopRest() { clearInterval(restRef.current); setRestRunning(false); setRestTimer(0); }

  // ── Start workout ─────────────────────────────────────────────────────────
  function startWorkout(template = null) {
    const w = {
      name:      template ? template.name : 'Quick Workout',
      startTime: Date.now(),
      exercises: template
        ? template.exercises.map(e => ({
            id: e.id, name: e.name,
            sets: Array.from({ length: e.defaultSets || 3 }, () => ({
              weight: e.defaultWeight || '', reps: e.defaultReps || '', done: false,
            })),
          }))
        : [],
    };
    setWorkout(w);
    setElapsed(0);
    setNewPRs([]);
    setMode('active');
    startElapsed();
  }

  // ── Add exercise to active workout ────────────────────────────────────────
  function addExercise(ex) {
    setWorkout(w => ({
      ...w,
      exercises: [...w.exercises, {
        id: ex.id, name: ex.name,
        sets: [{ weight: '', reps: '', done: false }],
      }],
    }));
    setShowExPicker(false);
  }

  // ── Toggle set done — detect PR ───────────────────────────────────────────
  function toggleSetDone(exIdx, setIdx) {
    setWorkout(w => {
      const exercises = w.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        const sets = ex.sets.map((s, si) => si !== setIdx ? s : { ...s, done: !s.done });
        // PR check on mark-done
        const toggledSet = sets[setIdx];
        if (toggledSet.done) {
          const wt = parseFloat(toggledSet.weight) || 0;
          const rp = parseInt(toggledSet.reps) || 0;
          const e1rm = estimated1RM(wt, rp);
          const prev = prs[ex.id];
          if (wt > 0 && rp > 0 && (!prev || e1rm > prev.e1rm)) {
            const newPr = { weight: wt, reps: rp, date: today(), e1rm };
            setPrs(p => {
              const up = { ...p, [ex.id]: newPr };
              persist({ prs: up });
              return up;
            });
            setNewPRs(np => np.includes(ex.name) ? np : [...np, ex.name]);
          }
        }
        return { ...ex, sets };
      });
      return { ...w, exercises };
    });
    startRest();
  }

  function updateSet(exIdx, setIdx, field, val) {
    setWorkout(w => ({
      ...w,
      exercises: w.exercises.map((ex, ei) =>
        ei !== exIdx ? ex : {
          ...ex,
          sets: ex.sets.map((s, si) => si !== setIdx ? s : { ...s, [field]: val }),
        }
      ),
    }));
  }

  function addSet(exIdx) {
    setWorkout(w => ({
      ...w,
      exercises: w.exercises.map((ex, ei) =>
        ei !== exIdx ? ex : {
          ...ex,
          sets: [...ex.sets, { weight: ex.sets.at(-1)?.weight || '', reps: ex.sets.at(-1)?.reps || '', done: false }],
        }
      ),
    }));
  }

  function removeExercise(exIdx) {
    setWorkout(w => ({ ...w, exercises: w.exercises.filter((_, i) => i !== exIdx) }));
  }

  // ── Finish workout ────────────────────────────────────────────────────────
  function finishWorkout() {
    clearInterval(elapsedRef.current);
    clearInterval(restRef.current);
    const session = {
      id:         Date.now(),
      date:       today(),
      name:       workout.name,
      duration:   elapsed,
      exercises:  workout.exercises,
      volume:     calcVolume(workout.exercises),
    };
    const updated = [session, ...workouts].slice(0, 100);
    setWorkouts(updated);
    persist({ workouts: updated });
    setWorkout(null);
    setMode('home');
  }

  // ── Save as template ──────────────────────────────────────────────────────
  function saveTemplate() {
    if (!tmplName.trim() || !workout?.exercises?.length) return;
    const t = {
      id:        Date.now(),
      name:      tmplName.trim(),
      exercises: workout.exercises.map(ex => ({
        id: ex.id, name: ex.name,
        defaultSets:   ex.sets.length,
        defaultReps:   ex.sets[0]?.reps || '',
        defaultWeight: ex.sets[0]?.weight || '',
      })),
    };
    const updated = [t, ...templates];
    setTemplates(updated);
    persist({ templates: updated });
    setShowSaveTmpl(false); setTmplName('');
  }

  function deleteTemplate(id) {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    persist({ templates: updated });
  }

  const filteredEx = EXERCISES.filter(ex =>
    (exMuscle === 'All' || ex.muscles.some(m => m.toLowerCase().includes(exMuscle.toLowerCase()))) &&
    (exSearch === '' || ex.name.toLowerCase().includes(exSearch.toLowerCase()))
  );

  // ── Styles ────────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    scroll:  { flex: 1 },
    content: { padding: 16, maxWidth: 640, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
    btn:     { backgroundColor: accentColor, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
    btnTxt:  { fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700', letterSpacing: 1 },
    outBtn:  { borderWidth: 1, borderColor: mc.border, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
    outTxt:  { fontFamily: F.mono, fontSize: 12, color: mc.text2 },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 14, marginBottom: 12 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 8 },
    exRow:   { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
    exName:  { fontFamily: F.mono, fontSize: 13, color: mc.text },
    exSub:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 2 },
    setRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    setNum:  { fontFamily: F.mono, fontSize: 11, color: mc.text3, width: 20 },
    setInp:  { flex: 1, borderWidth: 1, borderColor: mc.border, padding: 7, fontFamily: F.mono, fontSize: 13, color: mc.text, textAlign: 'center' },
    doneBtn: { width: 34, height: 34, borderWidth: 1, borderColor: mc.border, alignItems: 'center', justifyContent: 'center' },
    doneBtnA:{ backgroundColor: accentColor, borderColor: accentColor },
    doneTxt: { fontFamily: F.mono, fontSize: 14, color: mc.text3 },
    doneTxA: { color: '#0A0A0A' },
    restBar: { backgroundColor: mc.card, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    restTxt: { fontFamily: F.mono, fontSize: 22, fontWeight: '700', color: restRunning ? accentColor : mc.text3 },
    tabs:    { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
    tab:     { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    tabA:    { borderColor: accentColor, backgroundColor: accentColor + '18' },
    tabTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    tabTxA:  { color: accentColor },
    prBadge: { backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
    prTxt:   { fontFamily: F.mono, fontSize: 9, color: '#000', fontWeight: '700' },
  });

  // ── ACTIVE WORKOUT ────────────────────────────────────────────────────────
  if (mode === 'active' && workout) {
    return (
      <ScrollView style={s.root} keyboardShouldPersistTaps="handled">
        <View style={s.content}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{workout.name}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: accentColor }}>{fmtDuration(elapsed)}</Text>
            </View>
            <TouchableOpacity style={{ borderWidth: 1, borderColor: '#4CAF7C', paddingHorizontal: 14, paddingVertical: 8 }} onPress={finishWorkout}>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#4CAF7C', fontWeight: '700' }}>FINISH</Text>
            </TouchableOpacity>
          </View>

          {/* PR banner */}
          {newPRs.length > 0 && (
            <View style={{ backgroundColor: '#FFD70020', borderWidth: 1, borderColor: '#FFD700', padding: 10, marginBottom: 12 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#FFD700' }}>
                New PR{newPRs.length > 1 ? 's' : ''}: {newPRs.join(', ')}
              </Text>
            </View>
          )}

          {/* Rest timer */}
          <View style={s.restBar}>
            <Text style={s.restTxt}>{restRunning ? fmtDuration(restTimer) : '—'}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>REST TIMER</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[60, 90, 120, 180].map(t => (
                <TouchableOpacity key={t} style={{ borderWidth: 1, borderColor: mc.border, paddingHorizontal: 8, paddingVertical: 5 }}
                  onPress={() => startRest(t)}>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{t}s</Text>
                </TouchableOpacity>
              ))}
              {restRunning && (
                <TouchableOpacity style={{ borderWidth: 1, borderColor: '#C85A6E', paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' }} onPress={stopRest}>
                  <Svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="#C85A6E" strokeWidth={2.5} strokeLinecap="round">
                    <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
                  </Svg>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Exercises */}
          {workout.exercises.map((ex, ei) => {
            const pr = prs[ex.id];
            return (
              <View key={ei} style={s.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={[s.exName, { flex: 1 }]}>{ex.name}</Text>
                  {pr && (
                    <View style={s.prBadge}>
                      <Text style={s.prTxt}>PR {pr.weight}kg×{pr.reps}</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => removeExercise(ei)} style={{ marginLeft: 8, padding: 4 }}>
                    <Svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke={mc.text3} strokeWidth={2.2} strokeLinecap="round">
                      <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
                    </Svg>
                  </TouchableOpacity>
                </View>

                {/* Set header */}
                <View style={[s.setRow, { marginBottom: 8 }]}>
                  <Text style={[s.setNum, { opacity: 0 }]}>0</Text>
                  <Text style={{ flex: 1, fontFamily: F.mono, fontSize: 9, color: mc.text3, textAlign: 'center', letterSpacing: 1 }}>KG</Text>
                  <Text style={{ flex: 1, fontFamily: F.mono, fontSize: 9, color: mc.text3, textAlign: 'center', letterSpacing: 1 }}>REPS</Text>
                  <View style={{ width: 34 }} />
                </View>

                {ex.sets.map((set, si) => (
                  <View key={si} style={s.setRow}>
                    <Text style={s.setNum}>{si + 1}</Text>
                    <TextInput
                      style={[s.setInp, set.done && { borderColor: accentColor, color: accentColor }]}
                      value={String(set.weight)}
                      onChangeText={v => updateSet(ei, si, 'weight', v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={mc.text3}
                    />
                    <TextInput
                      style={[s.setInp, set.done && { borderColor: accentColor, color: accentColor }]}
                      value={String(set.reps)}
                      onChangeText={v => updateSet(ei, si, 'reps', v)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={mc.text3}
                    />
                    <TouchableOpacity style={[s.doneBtn, set.done && s.doneBtnA]} onPress={() => toggleSetDone(ei, si)}>
                      <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={set.done ? '#000' : mc.text3} strokeWidth={2.5} strokeLinecap="round">
                        <Polyline points="20 6 9 17 4 12" />
                      </Svg>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity onPress={() => addSet(ei)} style={{ marginTop: 6 }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor }}>+ Add set</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Add exercise */}
          <TouchableOpacity style={s.outBtn} onPress={() => { setExSearch(''); setExMuscle('All'); setShowExPicker(true); }}>
            <Text style={s.outTxt}>+ Add Exercise</Text>
          </TouchableOpacity>

          {/* Save as template */}
          {workout.exercises.length > 0 && (
            <TouchableOpacity style={s.outBtn} onPress={() => { setTmplName(workout.name); setShowSaveTmpl(true); }}>
              <Text style={s.outTxt}>Save as Template</Text>
            </TouchableOpacity>
          )}

          {/* Volume summary */}
          <View style={{ borderWidth: 1, borderColor: mc.border, padding: 14, marginTop: 8 }}>
            <Text style={s.label}>SESSION VOLUME</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 22, color: accentColor, fontWeight: '700' }}>
              {calcVolume(workout.exercises).toLocaleString()} kg
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginTop: 4 }}>
              {workout.exercises.reduce((s, ex) => s + ex.sets.filter(st => st.done).length, 0)} sets completed
            </Text>
          </View>

          <TouchableOpacity style={[s.btn, { marginTop: 20 }]} onPress={finishWorkout}>
            <Text style={s.btnTxt}>FINISH WORKOUT</Text>
          </TouchableOpacity>
        </View>

        {/* Exercise picker modal */}
        <Modal visible={showExPicker} transparent animationType="slide" onRequestClose={() => setShowExPicker(false)}>
          <View style={{ flex: 1, backgroundColor: mc.bg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: mc.border }}>
              <Text style={{ fontFamily: F.serif, fontSize: 16, color: mc.text, flex: 1 }}>Add Exercise</Text>
              <TouchableOpacity onPress={() => setShowExPicker(false)} style={{ padding: 6 }}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={mc.text3} strokeWidth={1.8} strokeLinecap="round">
                  <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
                </Svg>
              </TouchableOpacity>
            </View>
            <TextInput
              style={{ margin: 12, borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, color: mc.text }}
              value={exSearch} onChangeText={setExSearch}
              placeholder="Search exercises…" placeholderTextColor={mc.text3}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12, marginBottom: 8 }}>
              {['All','Chest','Back','Shoulders','Biceps','Triceps','Core','Quads','Hamstrings','Glutes','Calves'].map(m => (
                <TouchableOpacity key={m} style={[s.tab, exMuscle === m && s.tabA, { marginRight: 6 }]} onPress={() => setExMuscle(m)}>
                  <Text style={[s.tabTxt, exMuscle === m && s.tabTxA]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView style={{ flex: 1 }}>
              {filteredEx.map(ex => (
                <TouchableOpacity key={ex.id} style={s.exRow} onPress={() => addExercise(ex)}>
                  <View style={{ paddingHorizontal: 16, flex: 1 }}>
                    <Text style={s.exName}>{ex.name}</Text>
                    <Text style={s.exSub}>{ex.muscles.join(', ')} · {ex.equipment}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* Save template modal */}
        <Modal visible={showSaveTmpl} transparent animationType="fade" onRequestClose={() => setShowSaveTmpl(false)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={1} onPress={() => setShowSaveTmpl(false)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{ backgroundColor: mc.card, padding: 24, width: 300, borderWidth: 1, borderColor: mc.border }}>
                <Text style={{ fontFamily: F.serif, fontSize: 16, color: mc.text, marginBottom: 14 }}>Save as Template</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, color: mc.text, marginBottom: 16 }}
                  value={tmplName} onChangeText={setTmplName}
                  placeholder="Template name" placeholderTextColor={mc.text3} autoFocus
                />
                <TouchableOpacity style={s.btn} onPress={saveTemplate}>
                  <Text style={s.btnTxt}>SAVE</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    );
  }

  // ── HOME ──────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={s.root}>
      <GymOnboardingModal />
      <View style={s.content}>
        <Text style={s.title}>Workout Tracker</Text>
        <Text style={s.sub}>LOG SETS · REPS · WEIGHT</Text>

        <TouchableOpacity style={s.btn} onPress={() => startWorkout()}>
          <Text style={s.btnTxt}>START EMPTY WORKOUT</Text>
        </TouchableOpacity>

        {/* Templates */}
        {templates.length > 0 && (
          <>
            <Text style={[s.label, { marginTop: 8 }]}>WORKOUT TEMPLATES</Text>
            {templates.map(t => (
              <View key={t.id} style={[s.card, { flexDirection: 'row', alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.exName}>{t.name}</Text>
                  <Text style={s.exSub}>{t.exercises.length} exercises</Text>
                </View>
                <TouchableOpacity style={{ borderWidth: 1, borderColor: accentColor, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 }}
                  onPress={() => startWorkout(t)}>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor }}>Start</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteTemplate(t.id)} style={{ padding: 4 }}>
                  <Svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke={mc.text3} strokeWidth={2.2} strokeLinecap="round">
                    <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
                  </Svg>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Recent workouts */}
        {workouts.length > 0 && (
          <>
            <Text style={[s.label, { marginTop: 16 }]}>RECENT WORKOUTS</Text>
            {workouts.slice(0, 8).map(w => (
              <View key={w.id} style={s.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={s.exName}>{w.name}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>{fmtDate(w.date)}</Text>
                </View>
                <Text style={s.exSub}>
                  {w.exercises?.length} exercises · {w.volume?.toLocaleString()} kg · {fmtDuration(w.duration)}
                </Text>
              </View>
            ))}
          </>
        )}

        {workouts.length === 0 && templates.length === 0 && (
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3, textAlign: 'center', marginTop: 32 }}>
            No workouts yet.{'\n'}Tap "Start Empty Workout" to log your first session.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
