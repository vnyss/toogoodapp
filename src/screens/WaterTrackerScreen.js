import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import Svg, { Circle, Path, Text as SvgText, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function shortDay(iso) { return new Date(iso + 'T12:00').toLocaleDateString('en', { weekday: 'short' }); }
function fmtDate(iso) { return new Date(iso + 'T12:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }); }
function nowTime() { return new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }); }
function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

// ── Wave / cup display ────────────────────────────────────────────────────────
function WaterCup({ ml, goal, color, size = 200 }) {
  const pct  = Math.min(ml / Math.max(goal, 1), 1);
  const W = size, H = size;
  const cupX = W * 0.15, cupW = W * 0.7, cupH = H * 0.72, cupY = H * 0.15;
  const waterH = cupH * pct;
  const waterY = cupY + cupH - waterH;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.9" />
          <Stop offset="1" stopColor={color} stopOpacity="0.5" />
        </LinearGradient>
      </Defs>
      {/* cup outline */}
      <Path
        d={`M${cupX} ${cupY} L${cupX} ${cupY + cupH} Q${cupX + cupW / 2} ${cupY + cupH + 16} ${cupX + cupW} ${cupY + cupH} L${cupX + cupW} ${cupY}`}
        fill="none" stroke="#2a2a2a" strokeWidth={2}
      />
      {/* water fill */}
      {pct > 0 && (
        <Path
          d={`M${cupX + 1} ${waterY} L${cupX + 1} ${cupY + cupH} Q${cupX + cupW / 2} ${cupY + cupH + 14} ${cupX + cupW - 1} ${cupY + cupH} L${cupX + cupW - 1} ${waterY} Z`}
          fill="url(#waterGrad)"
        />
      )}
      {/* markers */}
      {[0.25, 0.5, 0.75].map(m => {
        const y = cupY + cupH * (1 - m);
        return <Path key={m} d={`M${cupX + 2} ${y} H${cupX + 12}`} stroke="#333" strokeWidth={1} />;
      })}
      {/* ml text */}
      <SvgText x={W / 2} y={cupY + cupH / 2 + 6} textAnchor="middle" fontSize={22} fontWeight="700" fill={pct > 0.4 ? '#fff' : color}>
        {ml}
      </SvgText>
      <SvgText x={W / 2} y={cupY + cupH / 2 + 24} textAnchor="middle" fontSize={10} fill={pct > 0.4 ? '#ffffffaa' : '#666'}>
        ml
      </SvgText>
      {/* goal */}
      <SvgText x={W / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#555">
        goal {goal} ml
      </SvgText>
    </Svg>
  );
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
function WeekBars({ data, goal, color }) {
  const W = 320, H = 70, pad = 12;
  const barW = Math.floor((W - pad * 2) / data.length) - 4;
  const max  = Math.max(...data.map(d => d.v), goal, 1);
  return (
    <Svg width="100%" height={H + 28} viewBox={`0 0 ${W} ${H + 28}`}>
      <Path d={`M${pad} ${H - (goal / max) * H} H${W - pad}`} stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
      {data.map((d, i) => {
        const x = pad + i * ((W - pad * 2) / data.length);
        const bH = Math.max(2, Math.round((d.v / max) * H));
        const hit = d.v >= goal;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={H - bH} width={barW} height={bH} fill={hit ? color : color + '55'} rx={2} />
            <SvgText x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize={8} fill="#666">{d.label}</SvgText>
            {d.v > 0 && (
              <SvgText x={x + barW / 2} y={H - bH - 4} textAnchor="middle" fontSize={7} fill={hit ? color : '#555'}>
                {d.v >= 1000 ? `${(d.v / 1000).toFixed(1)}L` : `${d.v}`}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const CONTAINERS = [
  { label: 'Sip',     ml: 100 },
  { label: 'Glass',   ml: 250 },
  { label: 'Bottle',  ml: 500 },
  { label: '1L Jug',  ml: 1000 },
];

const REMINDERS_KEY = 'tg_water_reminders';

export default function WaterTrackerScreen() {
  const { mc, accentColor } = useTheme();
  const [storageKey, setStorageKey] = useState(null);
  const [allData,    setAllData]    = useState({});
  const [goal,       setGoal]       = useState(2500);
  const [editGoal,   setEditGoal]   = useState(false);
  const [newGoal,    setNewGoal]    = useState('');
  const [customMl,   setCustomMl]   = useState('');
  const [tab,        setTab]        = useState('today');
  const [reminders,  setReminders]  = useState(false);

  const today     = todayISO();
  const todayData = allData[today] || { total: 0, logs: [] };
  const ml        = todayData.total;
  const pct       = Math.min(100, Math.round(ml / goal * 100));

  useEffect(() => {
    getUser().then(async u => {
      const key = `tg_water_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        setAllData(d.history || {});
        setGoal(d.goal || 2500);
      }
    });
  }, []);

  async function persist(newHistory, newGoal) {
    if (!storageKey) return;
    await AsyncStorage.setItem(storageKey, JSON.stringify({ history: newHistory, goal: newGoal }));
  }

  async function addWater(amount) {
    const prev = allData[today] || { total: 0, logs: [] };
    const updated = { total: prev.total + amount, logs: [...prev.logs, { time: nowTime(), amount }] };
    const newHistory = { ...allData, [today]: updated };
    setAllData(newHistory);
    await persist(newHistory, goal);
  }

  async function undoLast() {
    const prev = allData[today];
    if (!prev || !prev.logs.length) return;
    const logs   = prev.logs.slice(0, -1);
    const total  = logs.reduce((s, l) => s + l.amount, 0);
    const updated = { total, logs };
    const newHistory = { ...allData, [today]: updated };
    setAllData(newHistory);
    await persist(newHistory, goal);
  }

  async function saveGoal() {
    const g = parseInt(newGoal);
    if (!isNaN(g) && g > 0) { setGoal(g); await persist(allData, g); }
    setEditGoal(false);
  }

  // Streak
  const streak = (() => {
    let s = 0; const d = new Date();
    while (true) {
      const iso = d.toISOString().slice(0, 10);
      const e = allData[iso];
      if (iso === today) { d.setDate(d.getDate() - 1); continue; }
      if (e && e.total >= goal) { s++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return s;
  })();

  const weekDays = last7Days();
  const weekData = weekDays.map(iso => ({ label: shortDay(iso).slice(0, 2), v: allData[iso]?.total || 0 }));
  const histDays = Object.entries(allData).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);

  // Hydration insight
  function insight() {
    if (pct >= 100) return 'Fully hydrated today. Excellent!';
    if (pct >= 75)  return 'Almost there — one more glass!';
    if (pct >= 50)  return 'Halfway through your goal.';
    if (pct >= 25)  return '⚠️ Keep sipping — you\'re behind.';
    return 'Start hydrating — you need more water.';
  }

  const WATER_COLOR = '#42A5F5';

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 16, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
    tabs:    { flexDirection: 'row', gap: 6, marginBottom: 20 },
    tab:     { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    tabA:    { borderColor: WATER_COLOR, backgroundColor: WATER_COLOR + '18' },
    tabTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    tabTxA:  { color: WATER_COLOR },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 10 },
    qrow:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
    qbtn:    { flex: 1, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: WATER_COLOR },
    qbtnTxt: { fontFamily: F.mono, fontSize: 11, color: WATER_COLOR, fontWeight: '700' },
    qbtnSub: { fontFamily: F.mono, fontSize: 9, color: mc.text3, marginTop: 2 },
    input:   { borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, fontSize: 14, color: mc.text, flex: 1 },
    setBtn:  { backgroundColor: WATER_COLOR, paddingHorizontal: 14, justifyContent: 'center' },
    setBtnT: { fontFamily: F.mono, fontSize: 11, color: '#fff', fontWeight: '700' },
    logRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: mc.border },
    statRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
    statVal: { fontFamily: F.mono, fontSize: 22, fontWeight: '700', color: WATER_COLOR, textAlign: 'center' },
    statLbl: { fontFamily: F.mono, fontSize: 9, color: mc.text3, textAlign: 'center', marginTop: 2 },
    hrow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
  });

  const TABS = [{ k: 'today', l: 'Today' }, { k: 'weekly', l: 'Weekly' }, { k: 'history', l: 'History' }];

  return (
    <ScrollView style={s.root} keyboardShouldPersistTaps="handled">
      <View style={s.content}>
        <Text style={s.title}>Water Tracker</Text>
        <Text style={s.sub}>DAILY HYDRATION</Text>

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
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <WaterCup ml={ml} goal={goal} color={WATER_COLOR} size={200} />
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: pct >= 100 ? '#4CAF7C' : mc.text3, marginTop: 4 }}>
                {insight()}
              </Text>
            </View>

            <View style={s.card}>
              <View style={s.statRow}>
                <View>
                  <Text style={s.statVal}>{pct}%</Text>
                  <Text style={s.statLbl}>OF GOAL</Text>
                </View>
                <View>
                  <Text style={s.statVal}>{Math.max(0, goal - ml)}</Text>
                  <Text style={s.statLbl}>ML REMAINING</Text>
                </View>
                <View>
                  <Text style={[s.statVal, { color: '#FFB74D' }]}>{streak}</Text>
                  <Text style={s.statLbl}>DAY STREAK</Text>
                </View>
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.label}>QUICK ADD</Text>
              <View style={s.qrow}>
                {CONTAINERS.map(c => (
                  <TouchableOpacity key={c.label} style={s.qbtn} onPress={() => addWater(c.ml)}>
                    <Text style={s.qbtnTxt}>+{c.ml >= 1000 ? `${c.ml / 1000}L` : c.ml}</Text>
                    <Text style={s.qbtnSub}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.label, { marginTop: 8 }]}>CUSTOM AMOUNT (ML)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={s.input} value={customMl} onChangeText={setCustomMl} keyboardType="number-pad" placeholder="e.g. 350" placeholderTextColor={mc.text3} />
                <TouchableOpacity style={s.setBtn} onPress={() => { if (customMl) { addWater(parseInt(customMl) || 0); setCustomMl(''); } }}>
                  <Text style={s.setBtnT}>ADD</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={s.label}>DAILY GOAL</Text>
                <TouchableOpacity onPress={() => { setEditGoal(e => !e); setNewGoal(String(goal)); }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: WATER_COLOR }}>Edit</Text>
                </TouchableOpacity>
              </View>
              {editGoal ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput style={s.input} value={newGoal} onChangeText={setNewGoal} keyboardType="number-pad" />
                  <TouchableOpacity style={s.setBtn} onPress={saveGoal}><Text style={s.setBtnT}>SAVE</Text></TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {[1500, 2000, 2500, 3000, 3500].map(g => (
                    <TouchableOpacity key={g} onPress={async () => { setGoal(g); await persist(allData, g); }}
                      style={{ paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: goal === g ? WATER_COLOR : mc.border, backgroundColor: goal === g ? WATER_COLOR + '18' : 'transparent' }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: goal === g ? WATER_COLOR : mc.text3 }}>{g >= 1000 ? `${g / 1000}L` : `${g}ml`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {todayData.logs?.length > 0 && (
              <View style={s.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={s.label}>TODAY'S LOG</Text>
                  <TouchableOpacity onPress={undoLast}>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#E57373' }}>Undo last</Text>
                  </TouchableOpacity>
                </View>
                {[...todayData.logs].reverse().map((l, i) => (
                  <View key={i} style={s.logRow}>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>{l.time}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: WATER_COLOR }}>+{l.amount} ml</Text>
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
              <Text style={s.label}>LAST 7 DAYS (DASHED = GOAL)</Text>
              <WeekBars data={weekData} goal={goal} color={WATER_COLOR} />
            </View>
            <View style={s.card}>
              <Text style={s.label}>WEEK SUMMARY</Text>
              <View style={s.statRow}>
                <View>
                  <Text style={s.statVal}>{(weekData.reduce((s, d) => s + d.v, 0) / 1000).toFixed(1)}L</Text>
                  <Text style={s.statLbl}>TOTAL</Text>
                </View>
                <View>
                  <Text style={s.statVal}>{(weekData.reduce((s, d) => s + d.v, 0) / 7 / 1000).toFixed(1)}L</Text>
                  <Text style={s.statLbl}>DAILY AVG</Text>
                </View>
                <View>
                  <Text style={s.statVal}>{weekData.filter(d => d.v >= goal).length}</Text>
                  <Text style={s.statLbl}>GOALS HIT</Text>
                </View>
              </View>
            </View>
            {weekDays.map(iso => {
              const e = allData[iso] || { total: 0 };
              const hit = e.total >= goal;
              return (
                <View key={iso} style={s.hrow}>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, flex: 1 }}>{fmtDate(iso)}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 13, color: hit ? '#4CAF7C' : mc.text, fontWeight: hit ? '700' : '400' }}>
                    {(e.total / 1000).toFixed(2)} L
                  </Text>
                  {hit && <Text style={{ marginLeft: 6 }}>✓</Text>}
                </View>
              );
            })}
          </>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <View style={s.card}>
            <Text style={s.label}>ALL-TIME LOG (LAST 14 DAYS)</Text>
            {histDays.length === 0
              ? <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>No data yet. Log your first drink!</Text>
              : histDays.map(([iso, e]) => {
                  const hit = e.total >= goal;
                  return (
                    <View key={iso} style={s.hrow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{fmtDate(iso)}</Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{e.logs?.length || 0} entries</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 13, color: hit ? '#4CAF7C' : mc.text, fontWeight: '700' }}>
                          {(e.total / 1000).toFixed(2)} L
                        </Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>
                          {hit ? 'Goal hit ✓' : `${Math.round(e.total / goal * 100)}% of goal`}
                        </Text>
                      </View>
                    </View>
                  );
                })
            }
          </View>
        )}
      </View>
    </ScrollView>
  );
}
