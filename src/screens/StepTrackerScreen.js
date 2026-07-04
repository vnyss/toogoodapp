import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import Svg, { Circle, Path, Text as SvgText, Rect, Line, Polyline } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';
import { watchStatus, watchSyncGoogleFit, watchSyncGarmin, watchData } from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  return new Date(iso + 'T12:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
}
function shortDay(iso) {
  return new Date(iso + 'T12:00').toLocaleDateString('en', { weekday: 'short' });
}
function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

function stepsToKcal(steps, weightKg = 70) {
  return Math.round(steps * 0.04 * (weightKg / 70));
}
function stepsToKm(steps, heightCm = 170) {
  const stride = heightCm * 0.413 / 100;
  return (steps * stride / 1000).toFixed(2);
}
function stepsToActiveMin(steps) {
  return Math.round(steps / 100);
}

// ── SVG progress ring ─────────────────────────────────────────────────────────
function StepRing({ steps, goal, color, size = 200 }) {
  const C = size / 2, R = C - 16;
  const pct = Math.min(steps / Math.max(goal, 1), 1);
  const circ = 2 * Math.PI * R;
  const dash  = circ * pct;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={C} cy={C} r={R} fill="none" stroke="#2a2a2a" strokeWidth={12} />
      <Circle cx={C} cy={C} r={R} fill="none" stroke={color} strokeWidth={12}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${C} ${C})`} />
      <SvgText x={C} y={C - 10} textAnchor="middle" fontSize={36} fontWeight="700" fill={color}>
        {steps.toLocaleString()}
      </SvgText>
      <SvgText x={C} y={C + 14} textAnchor="middle" fontSize={11} fill="#666">
        steps
      </SvgText>
      <SvgText x={C} y={C + 32} textAnchor="middle" fontSize={10} fill="#555">
        goal {goal.toLocaleString()}
      </SvgText>
    </Svg>
  );
}

// ── Bar chart (weekly) ────────────────────────────────────────────────────────
function WeekChart({ data, goal, color }) {
  const W = 320, H = 80, pad = 12;
  const barW = Math.floor((W - pad * 2) / data.length) - 4;
  const max = Math.max(...data.map(d => d.v), goal, 1);
  return (
    <Svg width="100%" height={H + 28} viewBox={`0 0 ${W} ${H + 28}`}>
      {/* goal line */}
      <Path d={`M${pad} ${H - (goal / max) * H} H${W - pad}`} stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
      {data.map((d, i) => {
        const x   = pad + i * ((W - pad * 2) / data.length);
        const barH = Math.max(2, Math.round((d.v / max) * H));
        const hit  = d.v >= goal;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={H - barH} width={barW} height={barH} fill={hit ? color : color + '55'} rx={2} />
            <SvgText x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize={8} fill="#666">{d.label}</SvgText>
            {d.v > 0 && (
              <SvgText x={x + barW / 2} y={H - barH - 4} textAnchor="middle" fontSize={7} fill={hit ? color : '#555'}>
                {d.v >= 1000 ? `${(d.v / 1000).toFixed(1)}k` : d.v}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ── Badge definitions ─────────────────────────────────────────────────────────
const BADGES = [
  { id: 'first_steps',  label: 'First Steps',    desc: 'Log your first 1,000 steps',     thresh: d => d.total >= 1000 },
  { id: 'halfway',      label: 'Halfway There',  desc: 'Reach 5,000 steps in a day',     thresh: d => d.total >= 5000 },
  { id: 'goal_hit',     label: 'Goal Crusher',   desc: 'Hit your daily step goal',        thresh: (d, goal) => d.total >= goal },
  { id: 'overachiever', label: 'Overachiever',   desc: 'Reach 15,000 steps in a day',    thresh: d => d.total >= 15000 },
  { id: 'marathon',     label: 'Marathon Day',   desc: 'Walk more than 20km in a day',   thresh: (d, _g, h) => parseFloat(stepsToKm(d.total, h)) >= 20 },
];

const QUICK_ADD = [500, 1000, 2000, 5000];

export default function StepTrackerScreen() {
  const { mc, accentColor } = useTheme();
  const [storageKey, setStorageKey] = useState(null);
  const [allData,    setAllData]    = useState({});  // { [date]: { total, goal, logs } }
  const [goal,       setGoal]       = useState(10000);
  const [customInput,setCustomInput]= useState('');
  const [editGoal,   setEditGoal]   = useState(false);
  const [newGoal,    setNewGoal]    = useState('');
  const [tab,        setTab]        = useState('today');
  const [userHeight, setUserHeight] = useState(170);
  const [userWeight, setUserWeight] = useState(70);

  // ── Watch / API sync state ──
  const [watchConnected, setWatchConnected] = useState(null); // 'google_fit' | 'garmin' | null
  const [syncing,        setSyncing]        = useState(false);
  const [syncMsg,        setSyncMsg]        = useState('');
  const [watchStepsToday,setWatchStepsToday]= useState(null); // steps from API for today

  const loadWatchStatus = useCallback(async () => {
    try {
      const st = await watchStatus();
      if (st?.google_fit?.connected)  setWatchConnected('google_fit');
      else if (st?.garmin?.connected) setWatchConnected('garmin');
      else setWatchConnected(null);

      const today = todayISO();
      const data  = await watchData(today, today);
      const entry = (data || []).find(d => d.date === today);
      if (entry?.steps) setWatchStepsToday(entry.steps);
    } catch {}
  }, []);

  async function syncFromWatch() {
    if (!watchConnected) return;
    setSyncing(true); setSyncMsg('');
    try {
      const fn  = watchConnected === 'google_fit' ? watchSyncGoogleFit : watchSyncGarmin;
      const res = await fn(7);
      if (res?.ok) {
        const today = todayISO();
        const entry = (res.synced || []).find(d => d.date === today);
        if (entry?.steps) {
          setWatchStepsToday(entry.steps);
          // Merge watch steps as today's total if higher
          setAllData(prev => {
            const prevEntry = prev[today] || { total: 0, goal, logs: [] };
            if (entry.steps > (prevEntry.total || 0)) {
              const updated = {
                ...prevEntry,
                total: entry.steps,
                logs: [...(prevEntry.logs || []), { time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }), count: entry.steps - (prevEntry.total || 0), note: `synced from ${watchConnected === 'google_fit' ? 'Google Fit' : 'Garmin'}` }],
              };
              const newHist = { ...prev, [today]: updated };
              if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify({ history: newHist, goal, height: userHeight, weight: userWeight }));
              return newHist;
            }
            return prev;
          });
          setSyncMsg(`Synced ${entry.steps.toLocaleString()} steps from ${watchConnected === 'google_fit' ? 'Google Fit' : 'Garmin'}.`);
        } else {
          setSyncMsg('Synced — no step data for today yet.');
        }
      } else {
        setSyncMsg(res?.error || 'Sync failed.');
      }
    } catch { setSyncMsg('Sync failed. Check your connection.'); }
    setSyncing(false);
  }

  // ── Legacy BLE state (kept for reference, UI replaced) ──
  const deviceRef = useRef(null);

  async function connectWatch() {
    if (!bleSupported) { setDeviceError('Web Bluetooth isn\'t supported in this browser. Try Chrome or Edge on desktop or Android.'); return; }
    setDeviceError('');
    setConnecting(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information', 'heart_rate'],
      });
      const server = await device.gatt.connect();
      deviceRef.current = device;
      setWatchName(device.name || 'Unnamed device');
      device.addEventListener('gattserverdisconnected', () => {
        setWatchName(n => n); // keep last-known name shown, but mark disconnected
        deviceRef.current = null;
        setBattery(null);
      });
      await persist(allData, goal, device.name || 'Unnamed device');

      // Best-effort: read battery level if the device exposes it (proves a live GATT link)
      try {
        const batSvc = await server.getPrimaryService('battery_service');
        const batChar = await batSvc.getCharacteristic('battery_level');
        const val = await batChar.readValue();
        setBattery(val.getUint8(0));
      } catch { setBattery(null); }
    } catch (e) {
      if (e?.name !== 'NotFoundError') { // user just cancelled the picker
        setDeviceError(e?.message || 'Could not connect to that device.');
      }
    } finally {
      setConnecting(false);
    }
  }

  function disconnectWatch() {
    try { deviceRef.current?.gatt?.disconnect(); } catch {}
    deviceRef.current = null;
    setWatchName(null);
    setBattery(null);
    persist(allData, goal, null);
  }

  const today     = todayISO();
  const todayData = allData[today] || { total: 0, goal, logs: [] };
  const steps     = todayData.total;

  useEffect(() => {
    getUser().then(async u => {
      const key = `tg_steps_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        setAllData(d.history || {});
        setGoal(d.goal || 10000);
        setUserHeight(d.height || 170);
        setUserWeight(d.weight || 70);
      }
      // Try to get height/weight from profile
      try {
        const res = await fetch('http://localhost:5000/api/v1/me');
        if (res.ok) {
          const p = await res.json();
          if (p.height) setUserHeight(parseFloat(p.height));
          if (p.weight) setUserWeight(parseFloat(p.weight));
        }
      } catch {}
    });
    loadWatchStatus();
  }, [loadWatchStatus]);

  async function persist(newHistory, newGoal, device = watchName) {
    if (!storageKey) return;
    await AsyncStorage.setItem(storageKey, JSON.stringify({
      history: newHistory, goal: newGoal, height: userHeight, weight: userWeight, device,
    }));
  }

  async function addSteps(count) {
    const time = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
    const prev = allData[today] || { total: 0, goal, logs: [] };
    const updated = {
      ...prev,
      total: prev.total + count,
      logs:  [...(prev.logs || []), { time, count }],
    };
    const newHistory = { ...allData, [today]: updated };
    setAllData(newHistory);
    await persist(newHistory, goal);
  }

  async function setManual(val) {
    const n = parseInt(val);
    if (isNaN(n) || n < 0) return;
    const prev = allData[today] || { total: 0, goal, logs: [] };
    const time = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
    const updated = { ...prev, total: n, logs: [...(prev.logs || []), { time, count: n - prev.total, note: 'manual set' }] };
    const newHistory = { ...allData, [today]: updated };
    setAllData(newHistory);
    setCustomInput('');
    await persist(newHistory, goal);
  }

  async function saveGoal() {
    const g = parseInt(newGoal);
    if (!isNaN(g) && g > 0) { setGoal(g); await persist(allData, g); }
    setEditGoal(false);
  }

  // Streak
  const streak = (() => {
    let s = 0, d = new Date();
    while (true) {
      const iso = d.toISOString().slice(0, 10);
      const entry = allData[iso];
      if (entry && entry.total >= goal) { s++; d.setDate(d.getDate() - 1); }
      else if (iso === today && (!entry || entry.total < goal)) { d.setDate(d.getDate() - 1); continue; }
      else break;
    }
    return s;
  })();

  // Weekly chart data
  const weekDays = last7Days();
  const weekData = weekDays.map(iso => ({
    label: shortDay(iso).slice(0, 2),
    v:     allData[iso]?.total || 0,
  }));

  // Badges earned today
  const earnedToday = BADGES.filter(b => b.thresh(todayData, goal, userHeight));

  // History entries
  const historyDays = Object.entries(allData).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);

  const kcal    = stepsToKcal(steps, userWeight);
  const km      = stepsToKm(steps, userHeight);
  const actMin  = stepsToActiveMin(steps);
  const pct     = Math.min(100, Math.round(steps / goal * 100));

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 16, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
    tabs:    { flexDirection: 'row', gap: 6, marginBottom: 20 },
    tab:     { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    tabA:    { borderColor: accentColor, backgroundColor: accentColor + '18' },
    tabTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    tabTxA:  { color: accentColor },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 10 },
    statRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
    statBox: { alignItems: 'center' },
    statVal: { fontFamily: F.mono, fontSize: 20, fontWeight: '700', color: accentColor },
    statLbl: { fontFamily: F.mono, fontSize: 9, color: mc.text3, marginTop: 2 },
    qrow:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
    qbtn:    { flex: 1, minWidth: 60, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: accentColor },
    qbtnTxt: { fontFamily: F.mono, fontSize: 11, color: accentColor, fontWeight: '700' },
    input:   { borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, fontSize: 14, color: mc.text, flex: 1 },
    setBtn:  { backgroundColor: accentColor, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
    setBtnT: { fontFamily: F.mono, fontSize: 11, color: '#0A0A0A', fontWeight: '700' },
    logRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: mc.border },
    logTime: { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    logCnt:  { fontFamily: F.mono, fontSize: 12, color: mc.text },
    badge:   { borderWidth: 1, borderColor: accentColor + '44', backgroundColor: accentColor + '11', padding: 10, marginRight: 8, marginBottom: 8, minWidth: 120 },
    badgeLbl:{ fontFamily: F.mono, fontSize: 11, color: accentColor, fontWeight: '700', marginBottom: 3 },
    badgeDsc:{ fontFamily: F.mono, fontSize: 9, color: mc.text3 },
    histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
    histDate:{ fontFamily: F.mono, fontSize: 11, color: mc.text, flex: 1 },
    histStep:{ fontFamily: F.mono, fontSize: 13, color: mc.text, fontWeight: '700', width: 80, textAlign: 'right' },
    histKm:  { fontFamily: F.mono, fontSize: 10, color: mc.text3, width: 60, textAlign: 'right' },
  });

  const TABS = [
    { k: 'today',   l: 'Today' },
    { k: 'weekly',  l: 'Weekly' },
    { k: 'history', l: 'History' },
    { k: 'badges',  l: 'Badges' },
  ];

  return (
    <ScrollView style={s.root} keyboardShouldPersistTaps="handled">
      <View style={s.content}>
        <Text style={s.title}>Step Tracker</Text>
        <Text style={s.sub}>DAILY MOVEMENT</Text>

        <View style={s.tabs}>
          {TABS.map(t => (
            <TouchableOpacity key={t.k} style={[s.tab, tab === t.k && s.tabA]} onPress={() => setTab(t.k)}>
              <Text style={[s.tabTxt, tab === t.k && s.tabTxA]}>{t.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── TODAY ── */}
        {tab === 'today' && (
          <>
            {/* Progress ring */}
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <StepRing steps={steps} goal={goal} color={pct >= 100 ? '#4CAF7C' : accentColor} />
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: pct >= 100 ? '#4CAF7C' : mc.text3, marginTop: 4 }}>
                {pct >= 100 ? 'Goal reached!' : `${pct}% of goal`}
              </Text>
            </View>

            {/* Watch sync card */}
            <View style={s.card}>
              <Text style={s.label}>WATCH SYNC</Text>
              {watchConnected ? (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF7C' }} />
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, fontWeight: '700' }}>
                      {watchConnected === 'google_fit' ? 'Google Fit' : 'Garmin'} connected
                    </Text>
                  </View>
                  {watchStepsToday != null && (
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 8 }}>
                      Today from watch: <Text style={{ color: accentColor, fontWeight: '700' }}>{watchStepsToday.toLocaleString()} steps</Text>
                    </Text>
                  )}
                  {!!syncMsg && (
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor, marginBottom: 8 }}>{syncMsg}</Text>
                  )}
                  <TouchableOpacity style={s.setBtn} onPress={syncFromWatch} disabled={syncing}>
                    <Text style={s.setBtnT}>{syncing ? 'SYNCING…' : 'SYNC FROM WATCH'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 10, lineHeight: 16 }}>
                    Connect Google Fit or Garmin in Watch Connect (Health section) to auto-sync your steps.
                  </Text>
                </View>
              )}
            </View>

            {/* Stats row */}
            <View style={s.card}>
              <View style={s.statRow}>
                <View style={s.statBox}>
                  <Text style={s.statVal}>{kcal}</Text>
                  <Text style={s.statLbl}>KCAL BURNED</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={s.statVal}>{km}</Text>
                  <Text style={s.statLbl}>KM</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={s.statVal}>{actMin}</Text>
                  <Text style={s.statLbl}>ACTIVE MIN</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={[s.statVal, { color: '#FFB74D' }]}>{streak}</Text>
                  <Text style={s.statLbl}>DAY STREAK</Text>
                </View>
              </View>
            </View>

            {/* Quick add */}
            <View style={s.card}>
              <Text style={s.label}>QUICK ADD STEPS</Text>
              <View style={s.qrow}>
                {QUICK_ADD.map(n => (
                  <TouchableOpacity key={n} style={s.qbtn} onPress={() => addSteps(n)}>
                    <Text style={s.qbtnTxt}>+{n >= 1000 ? `${n / 1000}k` : n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.label, { marginTop: 8 }]}>SET EXACT COUNT</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={s.input}
                  value={customInput}
                  onChangeText={setCustomInput}
                  placeholder="Enter total steps…"
                  placeholderTextColor={mc.text3}
                  keyboardType="number-pad"
                />
                <TouchableOpacity style={s.setBtn} onPress={() => setManual(customInput)}>
                  <Text style={s.setBtnT}>SET</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Goal setting */}
            <View style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={s.label}>DAILY GOAL</Text>
                <TouchableOpacity onPress={() => { setEditGoal(e => !e); setNewGoal(String(goal)); }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor }}>Edit</Text>
                </TouchableOpacity>
              </View>
              {editGoal ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput style={s.input} value={newGoal} onChangeText={setNewGoal} keyboardType="number-pad" />
                  <TouchableOpacity style={s.setBtn} onPress={saveGoal}><Text style={s.setBtnT}>SAVE</Text></TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  {[6000, 8000, 10000, 12000, 15000].map(g => (
                    <TouchableOpacity key={g} onPress={async () => { setGoal(g); await persist(allData, g); }}
                      style={{ paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: goal === g ? accentColor : mc.border, backgroundColor: goal === g ? accentColor + '18' : 'transparent' }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: goal === g ? accentColor : mc.text3 }}>{(g / 1000).toFixed(0)}k</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Today's log */}
            {todayData.logs?.length > 0 && (
              <View style={s.card}>
                <Text style={s.label}>TODAY'S LOG</Text>
                {[...todayData.logs].reverse().map((l, i) => (
                  <View key={i} style={s.logRow}>
                    <Text style={s.logTime}>{l.time}</Text>
                    <Text style={s.logCnt}>{l.count > 0 ? '+' : ''}{l.count?.toLocaleString?.()} steps</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── WEEKLY ── */}
        {tab === 'weekly' && (
          <>
            <View style={s.card}>
              <Text style={s.label}>LAST 7 DAYS</Text>
              <WeekChart data={weekData} goal={goal} color={accentColor} />
              <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, textAlign: 'right', marginTop: 4 }}>
                Dashed line = goal ({goal.toLocaleString()} steps)
              </Text>
            </View>
            <View style={s.card}>
              <Text style={s.label}>WEEK SUMMARY</Text>
              <View style={s.statRow}>
                <View style={s.statBox}>
                  <Text style={s.statVal}>{weekData.reduce((s, d) => s + d.v, 0).toLocaleString()}</Text>
                  <Text style={s.statLbl}>TOTAL STEPS</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={s.statVal}>{Math.round(weekData.reduce((s, d) => s + d.v, 0) / 7).toLocaleString()}</Text>
                  <Text style={s.statLbl}>DAILY AVG</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={s.statVal}>{weekData.filter(d => d.v >= goal).length}</Text>
                  <Text style={s.statLbl}>GOALS HIT</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={s.statVal}>{stepsToKm(weekData.reduce((s, d) => s + d.v, 0), userHeight)}</Text>
                  <Text style={s.statLbl}>KM TOTAL</Text>
                </View>
              </View>
            </View>
            {weekDays.map(iso => {
              const entry = allData[iso] || { total: 0 };
              const hit   = entry.total >= goal;
              return (
                <View key={iso} style={s.histRow}>
                  <Text style={s.histDate}>{fmtDate(iso)}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginRight: 8 }}>
                    {stepsToKm(entry.total, userHeight)} km
                  </Text>
                  <Text style={[s.histStep, { color: hit ? '#4CAF7C' : mc.text }]}>
                    {entry.total.toLocaleString()}
                  </Text>
                  {hit && <Text style={{ marginLeft: 6, fontSize: 14 }}>✓</Text>}
                </View>
              );
            })}
          </>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <View style={s.card}>
            <Text style={s.label}>ALL-TIME HISTORY (LAST 14 DAYS)</Text>
            {historyDays.length === 0
              ? <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>No data yet. Start logging steps!</Text>
              : historyDays.map(([iso, entry]) => {
                  const hit = entry.total >= (entry.goal || goal);
                  return (
                    <View key={iso} style={s.histRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.histDate}>{fmtDate(iso)}</Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>
                          {stepsToKcal(entry.total, userWeight)} kcal · {stepsToKm(entry.total, userHeight)} km · {stepsToActiveMin(entry.total)} min
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.histStep, { color: hit ? '#4CAF7C' : mc.text }]}>
                          {entry.total.toLocaleString()}
                        </Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>
                          {hit ? 'Goal hit ✓' : `${Math.round(entry.total / (entry.goal || goal) * 100)}%`}
                        </Text>
                      </View>
                    </View>
                  );
                })
            }
          </View>
        )}

        {/* ── BADGES ── */}
        {tab === 'badges' && (
          <>
            <View style={s.card}>
              <Text style={s.label}>TODAY'S ACHIEVEMENTS</Text>
              {earnedToday.length === 0
                ? <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>Keep walking — badges unlock as you hit milestones.</Text>
                : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {earnedToday.map(b => (
                      <View key={b.id} style={s.badge}>
                        <Text style={s.badgeLbl}>{b.label}</Text>
                        <Text style={s.badgeDsc}>{b.desc}</Text>
                      </View>
                    ))}
                  </View>
                )
              }
            </View>
            <View style={s.card}>
              <Text style={s.label}>ALL BADGES</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {BADGES.map(b => {
                  const earned = earnedToday.find(e => e.id === b.id);
                  return (
                    <View key={b.id} style={[s.badge, !earned && { opacity: 0.35, borderColor: mc.border, backgroundColor: 'transparent' }]}>
                      <Text style={[s.badgeLbl, !earned && { color: mc.text3 }]}>{b.label}</Text>
                      <Text style={s.badgeDsc}>{b.desc}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={s.card}>
              <Text style={s.label}>STREAK</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 48, fontWeight: '700', color: streak > 0 ? '#FFB74D' : mc.text3 }}>{streak}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>
                {streak === 0 ? 'Hit your goal today to start a streak.' : streak === 1 ? 'day in a row. Keep going!' : `days in a row`}
              </Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
