import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, TextInput } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';

const PROTOCOLS = [
  { key: '12:12', label: '12:12', fast: 12, eat: 12, desc: 'Beginner-friendly. Fast overnight 12h, eat in 12h window.' },
  { key: '16:8',  label: '16:8',  fast: 16, eat: 8,  desc: 'Most popular. Fast 16h, eat in an 8h window.' },
  { key: '18:6',  label: '18:6',  fast: 18, eat: 6,  desc: 'Intermediate. Fast 18h, tighter 6h eating window.' },
  { key: '20:4',  label: '20:4',  fast: 20, eat: 4,  desc: 'Advanced. Only 4h eating window per day.' },
  { key: 'OMAD',  label: 'OMAD',  fast: 23, eat: 1,  desc: 'One meal a day. Extreme — consult a doctor first.' },
  { key: 'custom',label: 'Custom',fast: 16, eat: 8,  desc: 'Set your own fasting and eating hours.' },
];

// What happens in your body during fasting
const BODY_STATES = [
  { h: 0,  label: 'Fed State',       color: '#E57373', desc: 'Digesting last meal. Insulin elevated. Body using glucose for fuel.' },
  { h: 4,  label: 'Post-Absorptive', color: '#FFB74D', desc: 'Digestion complete. Blood sugar stabilising. Fat stores beginning to release.' },
  { h: 8,  label: 'Glycogen Dip',    color: '#FFF176', desc: 'Liver glycogen depleting. Body shifting toward fat for fuel.' },
  { h: 12, label: 'Fat Burning',     color: '#81C784', desc: 'Liver glycogen nearly depleted. Fat oxidation increasing significantly.' },
  { h: 16, label: 'Ketosis Entry',   color: '#4CAF7C', desc: 'Ketones starting to appear. Autophagy (cellular cleanup) ramping up.' },
  { h: 20, label: 'Deep Ketosis',    color: '#26C6DA', desc: 'Full fat-burning mode. Strong autophagy. Mental clarity peaks for many.' },
  { h: 24, label: 'Extended Fast',   color: '#7C8BF5', desc: 'Growth hormone surges. Deep cellular repair. Medical supervision recommended.' },
];

function fmt(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
}
function fmtDur(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtStamp(ts) {
  return new Date(ts).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function addHours(ts, h) {
  return new Date(ts + h * 3600000).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

function Ring({ progress, size, color, bg, children }) {
  const r = (size - 24) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(1, Math.max(0, progress)) * circ;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size/2} cy={size/2} r={r} stroke={bg} strokeWidth={12} fill="none" />
        <Circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={12} fill="none"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ * 0.25} strokeLinecap="round" />
      </Svg>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

export default function FastingScreen() {
  const { mc, accentColor } = useTheme();
  const [protocol,   setProtocol]   = useState(PROTOCOLS[1]);
  const [fastStart,  setFastStart]  = useState(null);
  const [history,    setHistory]    = useState([]);
  const [storageKey, setStorageKey] = useState(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customFast, setCustomFast] = useState('16');
  const [customEat,  setCustomEat]  = useState('8');
  const [now,        setNow]        = useState(Date.now());
  const [tab,        setTab]        = useState('timer');

  useEffect(() => {
    getUser().then(async u => {
      const key = `tg_fasting_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.fastStart) setFastStart(d.fastStart);
      if (d.protocol)  { const p = PROTOCOLS.find(x => x.key === d.protocol.key); setProtocol(p || d.protocol); }
      if (d.history)   setHistory(d.history);
    });
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function save(patch) {
    if (!storageKey) return;
    const d = { fastStart, protocol: { key: protocol.key, fast: protocol.fast, eat: protocol.eat }, history, ...patch };
    await AsyncStorage.setItem(storageKey, JSON.stringify(d));
  }

  function startFast() { const ts = Date.now(); setFastStart(ts); save({ fastStart: ts }); }
  function stopFast() {
    if (!fastStart) return;
    const dur = Date.now() - fastStart;
    const entry = { start: fastStart, end: Date.now(), duration: dur, protocol: protocol.key };
    const hist = [entry, ...history].slice(0, 60);
    setHistory(hist); setFastStart(null);
    save({ fastStart: null, history: hist });
  }

  const fastMs    = protocol.fast * 3600000;
  const elapsed   = fastStart ? Math.max(0, now - fastStart) : 0;
  const remaining = Math.max(0, fastMs - elapsed);
  const progress  = fastMs > 0 ? Math.min(1, elapsed / fastMs) : 0;
  const done      = !!fastStart && elapsed >= fastMs;
  const elapsedH  = elapsed / 3600000;

  // Current body state
  const bodyState = BODY_STATES.slice().reverse().find(s => elapsedH >= s.h) || BODY_STATES[0];

  // Stats
  const completedFasts = history.filter(h => h.duration >= protocol.fast * 3600000 * 0.8);
  const totalHours     = Math.round(history.reduce((s, h) => s + h.duration, 0) / 3600000);
  const avgDuration    = history.length ? Math.round(history.reduce((s, h) => s + h.duration, 0) / history.length / 3600000 * 10) / 10 : 0;
  const longestFast    = history.length ? Math.round(Math.max(...history.map(h => h.duration)) / 3600000 * 10) / 10 : 0;
  const streak = (() => {
    if (!history.length) return 0;
    let s = 0;
    const days = new Set(history.map(h => new Date(h.start).toISOString().slice(0, 10)));
    let d = new Date();
    while (true) {
      const iso = d.toISOString().slice(0, 10);
      if (days.has(iso)) { s++; d.setDate(d.getDate() - 1); }
      else break;
      if (s > 365) break;
    }
    return s;
  })();

  const st = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 20, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 16 },
    tabs:    { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
    tab:     { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    tabA:    { borderColor: accentColor, backgroundColor: accentColor + '18' },
    tabTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    tabTxA:  { color: accentColor },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 10 },
    proto:   { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border, marginRight: 6, marginBottom: 6 },
    protoA:  { borderColor: accentColor, backgroundColor: accentColor + '18' },
    statRow: { flexDirection: 'row', justifyContent: 'space-around' },
    statVal: { fontFamily: F.mono, fontSize: 24, fontWeight: '700', textAlign: 'center' },
    statLbl: { fontFamily: F.mono, fontSize: 9, color: mc.text3, textAlign: 'center', marginTop: 2, letterSpacing: 1 },
    histRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
  });

  const TABS = [
    { k: 'timer',    l: 'Timer' },
    { k: 'stats',    l: 'Stats' },
    { k: 'guide',    l: 'Body Guide' },
    { k: 'history',  l: 'History' },
  ];

  return (
    <ScrollView style={st.root}>
      <View style={st.content}>
        <Text style={st.title}>Intermittent Fasting</Text>
        <Text style={st.sub}>TRACK YOUR FASTING WINDOW</Text>

        <View style={st.tabs}>
          {TABS.map(t => (
            <TouchableOpacity key={t.k} style={[st.tab, tab === t.k && st.tabA]} onPress={() => setTab(t.k)}>
              <Text style={[st.tabTxt, tab === t.k && st.tabTxA]}>{t.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── TIMER ── */}
        {tab === 'timer' && (
          <>
            {/* Protocol selector */}
            <View style={st.card}>
              <Text style={st.label}>PROTOCOL</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {PROTOCOLS.map(p => (
                  <TouchableOpacity key={p.key} style={[st.proto, protocol.key === p.key && st.protoA]}
                    onPress={() => p.key === 'custom' ? setShowCustom(true) : setProtocol(p)}
                    disabled={!!fastStart}
                  >
                    <Text style={[{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }, protocol.key === p.key && { color: accentColor }]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginTop: 8 }}>{protocol.desc}</Text>
            </View>

            {/* Ring timer */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Ring progress={progress} size={240} color={done ? '#4CAF7C' : accentColor} bg={mc.border}>
                <Text style={{ fontFamily: F.mono, fontSize: 40, color: done ? '#4CAF7C' : mc.text, fontWeight: '700', letterSpacing: 2 }}>{fmt(elapsed)}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 2, marginTop: 4 }}>ELAPSED</Text>
                {fastStart && (
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: done ? '#4CAF7C' : accentColor, marginTop: 8 }}>
                    {done ? 'Fast complete!' : `${fmt(remaining)} to go`}
                  </Text>
                )}
                <Text style={{ fontFamily: F.mono, fontSize: 9, color: fastStart ? bodyState.color : mc.text3, letterSpacing: 2, marginTop: 4 }}>
                  {fastStart ? bodyState.label.toUpperCase() : 'NOT FASTING'}
                </Text>
              </Ring>
            </View>

            {/* Eating window info */}
            {fastStart && (
              <View style={[st.card, { backgroundColor: accentColor + '08' }]}>
                <Text style={st.label}>TODAY'S SCHEDULE</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 4 }}>FAST STARTED</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 16, color: mc.text }}>{new Date(fastStart).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 4 }}>EAT FROM</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 16, color: accentColor }}>{addHours(fastStart, protocol.fast)}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 4 }}>EAT UNTIL</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 16, color: '#FFB74D' }}>{addHours(fastStart, protocol.fast + protocol.eat)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Body state during active fast */}
            {fastStart && (
              <View style={[st.card, { borderColor: bodyState.color + '44', backgroundColor: bodyState.color + '08' }]}>
                <Text style={[st.label, { color: bodyState.color }]}>CURRENT BODY STATE</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 14, color: bodyState.color, fontWeight: '700', marginBottom: 4 }}>{bodyState.label}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, lineHeight: 18 }}>{bodyState.desc}</Text>
              </View>
            )}

            {!fastStart
              ? <TouchableOpacity style={{ backgroundColor: accentColor, paddingVertical: 16, alignItems: 'center' }} onPress={startFast}>
                  <Text style={{ fontFamily: F.mono, fontSize: 13, color: '#0A0A0A', fontWeight: '700', letterSpacing: 2 }}>START FAST</Text>
                </TouchableOpacity>
              : <TouchableOpacity style={{ borderWidth: 1, borderColor: '#E57373', paddingVertical: 16, alignItems: 'center' }} onPress={stopFast}>
                  <Text style={{ fontFamily: F.mono, fontSize: 13, color: '#E57373', fontWeight: '700', letterSpacing: 2 }}>END FAST</Text>
                </TouchableOpacity>
            }
          </>
        )}

        {/* ── STATS ── */}
        {tab === 'stats' && (
          <>
            <View style={st.card}>
              <Text style={st.label}>ALL-TIME STATS</Text>
              <View style={st.statRow}>
                <View>
                  <Text style={[st.statVal, { color: accentColor }]}>{history.length}</Text>
                  <Text style={st.statLbl}>TOTAL FASTS</Text>
                </View>
                <View>
                  <Text style={[st.statVal, { color: '#4CAF7C' }]}>{totalHours}h</Text>
                  <Text style={st.statLbl}>HOURS FASTED</Text>
                </View>
                <View>
                  <Text style={[st.statVal, { color: '#FFB74D' }]}>{streak}</Text>
                  <Text style={st.statLbl}>DAY STREAK</Text>
                </View>
              </View>
            </View>
            <View style={st.card}>
              <Text style={st.label}>FAST ANALYSIS</Text>
              <View style={st.statRow}>
                <View>
                  <Text style={[st.statVal, { color: accentColor, fontSize: 18 }]}>{avgDuration}h</Text>
                  <Text style={st.statLbl}>AVG DURATION</Text>
                </View>
                <View>
                  <Text style={[st.statVal, { color: '#7C8BF5', fontSize: 18 }]}>{longestFast}h</Text>
                  <Text style={st.statLbl}>LONGEST FAST</Text>
                </View>
                <View>
                  <Text style={[st.statVal, { color: '#4CAF7C', fontSize: 18 }]}>{completedFasts.length}</Text>
                  <Text style={st.statLbl}>COMPLETED</Text>
                </View>
              </View>
            </View>

            {/* Protocol breakdown */}
            {history.length > 0 && (
              <View style={st.card}>
                <Text style={st.label}>BY PROTOCOL</Text>
                {Object.entries(
                  history.reduce((acc, h) => { acc[h.protocol] = (acc[h.protocol] || 0) + 1; return acc; }, {})
                ).sort((a, b) => b[1] - a[1]).map(([proto, count]) => (
                  <View key={proto} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: mc.border }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, flex: 1 }}>{proto}</Text>
                    <View style={{ flex: 2, height: 6, backgroundColor: mc.border, borderRadius: 3, marginHorizontal: 12 }}>
                      <View style={{ width: `${(count / history.length) * 100}%`, height: 6, backgroundColor: accentColor, borderRadius: 3 }} />
                    </View>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor, width: 30, textAlign: 'right' }}>{count}×</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={st.card}>
              <Text style={st.label}>BENEFITS UNLOCKED THIS SESSION</Text>
              {elapsedH === 0 && !fastStart ? (
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>Start a fast to track real-time body benefits.</Text>
              ) : (
                BODY_STATES.filter(s => s.h > 0 && s.h <= (elapsedH || 0)).map(s => (
                  <View key={s.h} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: mc.border }}>
                    <View style={{ width: 8, height: 8, backgroundColor: s.color, borderRadius: 4, marginTop: 4, marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 12, color: s.color, fontWeight: '700' }}>{s.label} at {s.h}h</Text>
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, lineHeight: 16 }}>{s.desc}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* ── BODY GUIDE ── */}
        {tab === 'guide' && (
          <>
            <View style={[st.card, { marginBottom: 20 }]}>
              <Text style={st.label}>WHAT HAPPENS WHEN YOU FAST</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, lineHeight: 18 }}>
                Your body transitions through distinct metabolic states as fasting progresses. Understanding these helps you choose the right protocol for your goals.
              </Text>
            </View>
            {BODY_STATES.map((s, i) => (
              <View key={s.h} style={[st.card, i > 0 && { borderColor: s.color + '44', backgroundColor: s.color + '06' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 10, height: 10, backgroundColor: s.color, borderRadius: 5, marginRight: 10 }} />
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: s.color, flex: 1 }}>
                    {s.h === 0 ? 'HOUR 0' : `AFTER ${s.h} HOURS`}
                  </Text>
                </View>
                <Text style={{ fontFamily: F.mono, fontSize: 13, color: s.color, fontWeight: '700', marginBottom: 6 }}>{s.label}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, lineHeight: 18 }}>{s.desc}</Text>
              </View>
            ))}
            <View style={[st.card, { marginTop: 8 }]}>
              <Text style={st.label}>TIPS FOR SUCCESS</Text>
              {[
                'Drink water, black coffee, or plain tea during the fast — zero calories is fine.',
                'Break your fast with a light, protein-rich meal — not a huge feast.',
                'Consistency matters more than perfection. Missing one day doesn\'t break progress.',
                'If you feel dizzy or unwell, break the fast — health first.',
                'Electrolytes (sodium, potassium, magnesium) can prevent headaches during extended fasts.',
              ].map((tip, i) => (
                <Text key={i} style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, lineHeight: 18, marginBottom: 8 }}>• {tip}</Text>
              ))}
            </View>
          </>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <View style={st.card}>
            <Text style={st.label}>FASTING HISTORY ({history.length} sessions)</Text>
            {history.length === 0
              ? <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>No fasts recorded yet. Start your first fast!</Text>
              : history.slice(0, 30).map((h, i) => {
                  const target = PROTOCOLS.find(p => p.key === h.protocol)?.fast || 16;
                  const success = h.duration >= target * 3600000 * 0.9;
                  return (
                    <View key={i} style={st.histRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text }}>{fmtStamp(h.start)}</Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{h.protocol} protocol</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 14, color: success ? '#4CAF7C' : '#FFB74D', fontWeight: '700' }}>{fmtDur(h.duration)}</Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{success ? 'Completed ✓' : 'Partial'}</Text>
                      </View>
                    </View>
                  );
                })
            }
          </View>
        )}
      </View>

      {/* Custom protocol modal */}
      <Modal visible={showCustom} transparent animationType="fade" onRequestClose={() => setShowCustom(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={1} onPress={() => setShowCustom(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: mc.bg, padding: 24, width: 300, borderWidth: 1, borderColor: mc.border }}>
              <Text style={{ fontFamily: F.serif, fontSize: 16, color: mc.text, marginBottom: 16 }}>Custom Protocol</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 6 }}>FASTING HOURS</Text>
              <TextInput style={{ borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, color: mc.text, marginBottom: 12 }}
                value={customFast} onChangeText={setCustomFast} keyboardType="number-pad" />
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 6 }}>EATING HOURS</Text>
              <TextInput style={{ borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, color: mc.text, marginBottom: 16 }}
                value={customEat} onChangeText={setCustomEat} keyboardType="number-pad" />
              <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, marginBottom: 14 }}>
                Total: {(parseInt(customFast)||0) + (parseInt(customEat)||0)}h / 24h
              </Text>
              <TouchableOpacity style={{ backgroundColor: accentColor, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => {
                  const f = parseInt(customFast) || 16, e = parseInt(customEat) || 8;
                  setProtocol({ key: 'custom', label: `${f}:${e}`, fast: f, eat: e, desc: `Fast ${f}h · eat in ${e}h window` });
                  setShowCustom(false);
                }}>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700' }}>SET PROTOCOL</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}
