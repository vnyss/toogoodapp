import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import Svg, { Rect, Line, Path, Text as SvgText, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';
import { EXERCISES } from '../data/exercises';
import GymOnboardingModal, { gymProfileKey, LIFTS } from '../components/GymOnboardingModal';
import { IS_ELECTRON } from '../config';
import * as local from '../localStore';
import { API_BASE } from '../config';

function estimated1RM(w, r) { return r === 1 ? w : Math.round(w * (1 + r / 30)); }
function weekOf(iso) {
  const d = new Date(iso + 'T12:00');
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
function fmtDate(iso) {
  return new Date(iso + 'T12:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// Mini bar chart
function BarChart({ data, color, height = 80 }) {
  if (!data.length) return null;
  const W = 300, pad = 24, barW = Math.min(24, (W - pad * 2) / data.length - 4);
  const maxVal = Math.max(...data.map(d => d.v), 1);
  return (
    <Svg width="100%" height={height + 20} viewBox={`0 0 ${W} ${height + 20}`}>
      {data.map((d, i) => {
        const x = pad + i * ((W - pad * 2) / data.length);
        const barH = Math.round((d.v / maxVal) * height);
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={height - barH} width={barW} height={barH} fill={color} opacity={0.8} />
            <SvgText x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize={7} fill="#666">
              {d.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// Muscle group heatmap (simplified frequency grid)
const MUSCLE_LIST = ['Chest','Back','Shoulders','Biceps','Triceps','Core','Quads','Hamstrings','Glutes','Calves'];

// ─── Inline PIN gate (reuses diary PIN) ─────────────────────────────────────
function GymPinRow({ onComplete }) {
  const containerRef = useRef(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';
    container.style.cssText = 'display:flex;gap:12px;justify-content:center;align-items:center;';
    const inputs = [], vals = ['', '', '', ''];
    function tryComplete() {
      if (vals.every(v => v !== '')) onComplete(vals.join(''), () => {
        vals.forEach((_, i) => { vals[i] = ''; inputs[i].value = ''; });
        inputs[0]?.focus();
      });
    }
    const dotsRow = document.createElement('div');
    dotsRow.style.cssText = 'display:flex;gap:10px;margin-bottom:12px;position:absolute;top:-28px;left:50%;transform:translateX(-50%);';
    const dots = [];
    for (let i = 0; i < 4; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = 'width:10px;height:10px;border-radius:50%;border:2px solid rgba(201,168,76,0.38);background:transparent;transition:background 0.1s,border-color 0.1s;';
      dots.push(dot); dotsRow.appendChild(dot);
    }
    function updateDot(idx, filled, err) {
      if (!dots[idx]) return;
      const c = err ? '#CF6679' : '#C9A84C';
      const b = err ? 'rgba(207,102,121,0.38)' : 'rgba(201,168,76,0.38)';
      dots[idx].style.background = filled ? c : 'transparent';
      dots[idx].style.borderColor = filled ? c : b;
    }
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;padding-top:28px;';
    wrap.appendChild(dotsRow);
    for (let i = 0; i < 4; i++) {
      const inp = document.createElement('input');
      inp.type = 'password'; inp.maxLength = 1; inp.inputMode = 'numeric';
      inp.style.cssText = 'width:56px;height:68px;background:#161616;border:2px solid rgba(201,168,76,0.12);color:#EDE3CE;font-family:\'JetBrains Mono\',monospace;font-size:32px;text-align:center;outline:none;caret-color:transparent;box-sizing:border-box;';
      inp.onfocus = () => { inp.style.borderColor = '#C9A84C'; };
      inp.onblur  = () => { inp.style.borderColor = vals[i] ? 'rgba(201,168,76,0.38)' : 'rgba(201,168,76,0.12)'; };
      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace') {
          if (!vals[i] && i > 0) { vals[i-1]=''; inputs[i-1].value=''; updateDot(i-1,false); inputs[i-1].focus(); }
          else { vals[i]=''; inp.value=''; updateDot(i,false); }
          e.preventDefault();
        }
      });
      inp.addEventListener('input', () => {
        const digit = inp.value.replace(/\D/g,'').slice(-1);
        inp.value = digit; vals[i] = digit; updateDot(i, !!digit);
        if (digit && i < 3) inputs[i+1].focus();
        tryComplete();
      });
      wrap.appendChild(inp); inputs.push(inp);
    }
    container.appendChild(wrap);
    setTimeout(() => inputs[0]?.focus(), 120);
    return () => { container.innerHTML = ''; };
  }, []);
  return <View ref={containerRef} style={{ flexDirection: 'row', justifyContent: 'center', height: 124, alignItems: 'flex-end' }} />;
}

export default function GymProgressScreen() {
  const { mc, accentColor } = useTheme();
  const [locked,    setLocked]    = useState(null); // null=checking, true=locked, false=open
  const [pinHint,   setPinHint]   = useState('Enter your PIN to access Workout Journal');
  const [pinErr,    setPinErr]    = useState(false);
  const [workouts,  setWorkouts]  = useState([]);
  const [prs,       setPrs]       = useState({});
  const [activeTab, setActiveTab] = useState('streak');
  const [gymProfile,    setGymProfile]    = useState(null);
  const [editingProfile,setEditingProfile]= useState(false);

  useEffect(() => {
    checkLock();
  }, []);

  async function checkLock() {
    try {
      let lock = IS_ELECTRON ? (await local.getDiaryLock()) : await (async () => {
        const t = await import('../auth').then(m => m.getToken());
        const h = t ? { Authorization: 'Bearer ' + t } : {};
        const r = await fetch(API_BASE + '/perfect/api/diary/lock', { headers: h });
        return r.json();
      })();
      if (lock?.setup_done && lock?.enabled) { setLocked(true); return; }
    } catch {}
    setLocked(false);
    loadGymData();
  }

  async function handlePin(pin, reset) {
    let valid = false;
    try {
      if (IS_ELECTRON) {
        const r = await local.setDiaryLock({ action: 'verify', pin });
        valid = !!r?.valid;
      } else {
        const t = await import('../auth').then(m => m.getToken());
        const h = { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) };
        const r = await fetch(API_BASE + '/perfect/api/diary/lock', {
          method: 'POST', headers: h, body: JSON.stringify({ action: 'verify', pin }),
        });
        const d = await r.json();
        valid = !!d?.valid;
      }
    } catch {}
    if (valid) { setLocked(false); loadGymData(); }
    else {
      setPinErr(true); setPinHint('Wrong PIN — try again');
      setTimeout(() => { reset?.(); setPinErr(false); setPinHint('Enter your PIN to access Workout Journal'); }, 900);
    }
  }

  function loadGymData() {
    getUser().then(async u => {
      const raw = await AsyncStorage.getItem(`tg_gym_${u}`);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.workouts) setWorkouts(d.workouts);
        if (d.prs)      setPrs(d.prs);
      }
      const praw = await AsyncStorage.getItem(gymProfileKey(u));
      if (praw) setGymProfile(JSON.parse(praw));
    });
  }

  // Streak calculation (consecutive weeks)
  const streakWeeks = (() => {
    if (!workouts.length) return 0;
    const weekSet = new Set(workouts.map(w => weekOf(w.date)));
    const weeks = [...weekSet].sort().reverse();
    const thisWeek = weekOf(new Date().toISOString().slice(0, 10));
    let streak = 0, current = thisWeek;
    for (const w of weeks) {
      if (w === current) { streak++; const d = new Date(current + 'T12:00'); d.setDate(d.getDate() - 7); current = d.toISOString().slice(0, 10); }
      else if (w < current) break;
    }
    return streak;
  })();

  // Weekly volume data (last 8 weeks)
  const volumeData = (() => {
    const map = {};
    workouts.forEach(w => { const wk = weekOf(w.date); map[wk] = (map[wk] || 0) + (w.volume || 0); });
    return Object.entries(map).sort().slice(-8).map(([k, v]) => ({
      label: fmtDate(k).split(' ')[0],
      v,
    }));
  })();

  // Muscle frequency (last 14 days)
  const cutoff = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const muscleFreq = {};
  workouts.filter(w => w.date >= cutoff).forEach(w => {
    (w.exercises || []).forEach(ex => {
      const exData = EXERCISES.find(e => e.id === ex.id);
      (exData?.muscles || []).forEach(m => { muscleFreq[m] = (muscleFreq[m] || 0) + 1; });
    });
  });

  // Total workouts, volume
  const totalWorkouts = workouts.length;
  const totalVolume   = workouts.reduce((s, w) => s + (w.volume || 0), 0);
  const avgVolume     = totalWorkouts ? Math.round(totalVolume / totalWorkouts) : 0;

  // PRs list
  const prList = Object.entries(prs).map(([id, pr]) => {
    const ex = EXERCISES.find(e => e.id === id);
    return { name: ex?.name || id, ...pr };
  }).sort((a, b) => b.e1rm - a.e1rm);

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 16, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
    tabs:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 20 },
    tab:     { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    tabA:    { borderColor: accentColor, backgroundColor: accentColor + '18' },
    tabTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    tabTxA:  { color: accentColor },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 10 },
    stat:    { fontFamily: F.mono, fontSize: 32, color: accentColor, fontWeight: '700' },
    statSub: { fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 2 },
    statRow: { flexDirection: 'row', gap: 20, flexWrap: 'wrap', marginTop: 12 },
    statMet: { alignItems: 'center' },
    prRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
    prName:  { fontFamily: F.mono, fontSize: 12, color: mc.text, flex: 1 },
    prVal:   { fontFamily: F.mono, fontSize: 12, color: accentColor },
  });

  const TABS = [
    { key: 'streak',  label: 'Streak & Stats' },
    { key: 'volume',  label: 'Volume' },
    { key: 'prs',     label: 'Personal Records' },
    { key: 'muscles', label: 'Muscle Map' },
  ];

  if (locked === null) {
    return <View style={{ flex: 1, backgroundColor: mc.bg }} />;
  }

  if (locked) {
    return (
      <View style={{ flex: 1, backgroundColor: mc.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: F.serif, fontSize: 22, color: mc.text, marginBottom: 6, textAlign: 'center' }}>
          Workout Journal
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 40, textAlign: 'center' }}>
          PASSWORD PROTECTED
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: pinErr ? '#CF6679' : mc.text3, marginBottom: 24, textAlign: 'center' }}>
          {pinHint}
        </Text>
        <GymPinRow onComplete={handlePin} />
      </View>
    );
  }

  return (
    <ScrollView style={s.root}>
      <GymOnboardingModal
        forceOpen={editingProfile}
        existingProfile={gymProfile}
        onComplete={setGymProfile}
        onClose={() => setEditingProfile(false)}
      />
      <View style={s.content}>
        <Text style={s.title}>Gym Progress</Text>
        <Text style={s.sub}>YOUR STRENGTH JOURNEY</Text>

        <View style={s.tabs}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabA]} onPress={() => setActiveTab(t.key)}>
              <Text style={[s.tabTxt, activeTab === t.key && s.tabTxA]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* STREAK & STATS */}
        {activeTab === 'streak' && (
          <>
            <View style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: gymProfile ? 10 : 0 }}>
                <Text style={[s.label, { marginBottom: 0 }]}>GYM PROFILE</Text>
                <TouchableOpacity onPress={() => setEditingProfile(true)}>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor }}>{gymProfile ? 'Edit' : 'Set up'}</Text>
                </TouchableOpacity>
              </View>
              {gymProfile ? (
                <>
                  <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text, textTransform: 'capitalize', marginBottom: 8 }}>{gymProfile.level}</Text>
                  {gymProfile.maxes && Object.keys(gymProfile.maxes).length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                      {LIFTS.filter(l => gymProfile.maxes[l.key]).map(l => (
                        <View key={l.key}>
                          <Text style={{ fontFamily: F.mono, fontSize: 14, color: accentColor }}>{gymProfile.maxes[l.key]}kg</Text>
                          <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{l.label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>No maxes recorded yet.</Text>
                  )}
                </>
              ) : (
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>Set your experience level and maxes to personalise your training.</Text>
              )}
            </View>
            <View style={s.card}>
              <Text style={s.label}>WORKOUT STREAK</Text>
              <Text style={s.stat}>{streakWeeks}</Text>
              <Text style={s.statSub}>{streakWeeks === 1 ? 'week' : 'weeks'} in a row</Text>
            </View>
            <View style={s.card}>
              <Text style={s.label}>ALL TIME STATS</Text>
              <View style={s.statRow}>
                <View style={s.statMet}>
                  <Text style={[s.stat, { fontSize: 24 }]}>{totalWorkouts}</Text>
                  <Text style={s.statSub}>WORKOUTS</Text>
                </View>
                <View style={s.statMet}>
                  <Text style={[s.stat, { fontSize: 24 }]}>{(totalVolume / 1000).toFixed(1)}t</Text>
                  <Text style={s.statSub}>TOTAL VOLUME</Text>
                </View>
                <View style={s.statMet}>
                  <Text style={[s.stat, { fontSize: 24 }]}>{avgVolume.toLocaleString()}</Text>
                  <Text style={s.statSub}>AVG KG/SESSION</Text>
                </View>
              </View>
            </View>
            {workouts.slice(0, 5).map((w, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: mc.border }}>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{w.name}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor }}>{(w.volume || 0).toLocaleString()} kg</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{fmtDate(w.date)}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* VOLUME CHART */}
        {activeTab === 'volume' && (
          <View style={s.card}>
            <Text style={s.label}>WEEKLY VOLUME (KG LIFTED)</Text>
            {volumeData.length > 0
              ? <BarChart data={volumeData} color={accentColor} />
              : <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>No workout data yet.</Text>
            }
          </View>
        )}

        {/* PRs */}
        {activeTab === 'prs' && (
          <View style={s.card}>
            <Text style={s.label}>PERSONAL RECORDS (EST. 1RM)</Text>
            {prList.length === 0
              ? <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>No PRs yet. Complete sets during workouts to track records.</Text>
              : prList.map((pr, i) => (
                <View key={i} style={s.prRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.prName}>{pr.name}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{pr.weight}kg × {pr.reps} reps · {fmtDate(pr.date)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.prVal}>{pr.e1rm} kg</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>est. 1RM</Text>
                  </View>
                </View>
              ))
            }
          </View>
        )}

        {/* MUSCLE MAP */}
        {activeTab === 'muscles' && (
          <View style={s.card}>
            <Text style={s.label}>MUSCLE FREQUENCY (LAST 14 DAYS)</Text>
            {MUSCLE_LIST.map(m => {
              const freq = muscleFreq[m] || 0;
              const maxFreq = Math.max(...MUSCLE_LIST.map(x => muscleFreq[x] || 0), 1);
              const pct = freq / maxFreq;
              const color = freq === 0 ? mc.border : pct > 0.7 ? '#E57373' : pct > 0.4 ? accentColor : '#4CAF7C';
              return (
                <View key={m} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: mc.border }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, width: 110 }}>{m}</Text>
                  <View style={{ flex: 1, height: 8, backgroundColor: mc.border, borderRadius: 4, marginHorizontal: 10 }}>
                    <View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: color, borderRadius: 4 }} />
                  </View>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color, width: 50, textAlign: 'right' }}>
                    {freq > 0 ? `${freq}×` : '—'}
                  </Text>
                </View>
              );
            })}
            {Object.keys(muscleFreq).length === 0 && (
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3, marginTop: 8 }}>
                No workouts in the last 14 days.
              </Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
