import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, TextInput } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';

const PROTOCOLS = [
  { key: '16:8',  label: '16:8',  fast: 16, eat: 8,  desc: 'Fast 16h · eat in 8h window — most popular' },
  { key: '18:6',  label: '18:6',  fast: 18, eat: 6,  desc: 'Fast 18h · eat in 6h window' },
  { key: '20:4',  label: '20:4',  fast: 20, eat: 4,  desc: 'Fast 20h · eat in 4h window' },
  { key: 'OMAD',  label: 'OMAD',  fast: 23, eat: 1,  desc: 'One meal a day' },
  { key: 'custom',label: 'Custom',fast: 16, eat: 8,  desc: 'Set your own fasting window' },
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

function Ring({ progress, size, color, bg, children }) {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(1, Math.max(0, progress)) * circ;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size/2} cy={size/2} r={r} stroke={bg} strokeWidth={10} fill="none" />
        <Circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={10} fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

export default function FastingScreen() {
  const { mc, accentColor } = useTheme();
  const [protocol,    setProtocol]    = useState(PROTOCOLS[0]);
  const [fastStart,   setFastStart]   = useState(null);
  const [history,     setHistory]     = useState([]);
  const [storageKey,  setStorageKey]  = useState(null);
  const [showCustom,  setShowCustom]  = useState(false);
  const [customFast,  setCustomFast]  = useState('16');
  const [customEat,   setCustomEat]   = useState('8');
  const [now,         setNow]         = useState(Date.now());

  useEffect(() => {
    getUser().then(async u => {
      const key = `tg_fasting_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.fastStart)  setFastStart(d.fastStart);
      if (d.protocol)   { const p = PROTOCOLS.find(x => x.key === d.protocol.key); setProtocol(p || d.protocol); }
      if (d.history)    setHistory(d.history);
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
    const entry = { start: fastStart, end: Date.now(), duration: Date.now() - fastStart, protocol: protocol.key };
    const hist = [entry, ...history].slice(0, 30);
    setHistory(hist); setFastStart(null);
    save({ fastStart: null, history: hist });
  }

  const fastMs   = protocol.fast * 3600 * 1000;
  const elapsed  = fastStart ? Math.max(0, now - fastStart) : 0;
  const remaining = Math.max(0, fastMs - elapsed);
  const progress  = fastMs > 0 ? Math.min(1, elapsed / fastMs) : 0;
  const done      = !!fastStart && elapsed >= fastMs;

  const st = StyleSheet.create({
    root:       { flex: 1, backgroundColor: mc.bg },
    content:    { padding: 20, maxWidth: 560, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:      { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:        { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 24 },
    protos:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    proto:      { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    protoA:     { borderColor: accentColor, backgroundColor: accentColor + '18' },
    protoTxt:   { fontFamily: F.mono, fontSize: 12, color: mc.text3 },
    protoTxtA:  { color: accentColor },
    desc:       { fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 28 },
    ring:       { alignItems: 'center', marginBottom: 28 },
    elapsed:    { fontFamily: F.mono, fontSize: 36, color: mc.text, fontWeight: '700', letterSpacing: 2 },
    elbl:       { fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 2, marginTop: 4 },
    rem:        { fontFamily: F.mono, fontSize: 13, color: mc.text2, marginTop: 10, textAlign: 'center' },
    phase:      { fontFamily: F.mono, fontSize: 10, letterSpacing: 2, marginTop: 6 },
    startBtn:   { backgroundColor: accentColor, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
    stopBtn:    { borderWidth: 1, borderColor: '#E57373', paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
    btnTxt:     { fontFamily: F.mono, fontSize: 12, letterSpacing: 2, fontWeight: '700', color: '#0A0A0A' },
    stamp:      { fontFamily: F.mono, fontSize: 10, color: mc.text3, textAlign: 'center', marginBottom: 16 },
    histLbl:    { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginTop: 28, marginBottom: 10 },
    histRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
    histDate:   { fontFamily: F.mono, fontSize: 11, color: mc.text2 },
    histProto:  { fontFamily: F.mono, fontSize: 9, color: mc.text3, marginTop: 2 },
    histDur:    { fontFamily: F.mono, fontSize: 13, color: accentColor },
  });

  return (
    <ScrollView style={st.root}>
      <View style={st.content}>
        <Text style={st.title}>Intermittent Fasting</Text>
        <Text style={st.sub}>TRACK YOUR FASTING WINDOW</Text>

        <View style={st.protos}>
          {PROTOCOLS.map(p => (
            <TouchableOpacity key={p.key}
              style={[st.proto, protocol.key === p.key && st.protoA]}
              onPress={() => { if (p.key === 'custom') { setShowCustom(true); } else { setProtocol(p); } }}
            >
              <Text style={[st.protoTxt, protocol.key === p.key && st.protoTxtA]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={st.desc}>{protocol.desc}</Text>

        <View style={st.ring}>
          <Ring progress={progress} size={220} color={done ? '#4CAF7C' : accentColor} bg={mc.border}>
            <Text style={st.elapsed}>{fmt(elapsed)}</Text>
            <Text style={st.elbl}>TIME FASTED</Text>
            {fastStart && (
              <Text style={st.rem}>{done ? 'Fast complete 🎉' : `${fmt(remaining)} to go`}</Text>
            )}
            <Text style={[st.phase, { color: fastStart ? accentColor : mc.text3 }]}>
              {fastStart ? (done ? '✓ EATING WINDOW' : '⚡ FASTING') : 'NOT FASTING'}
            </Text>
          </Ring>
        </View>

        {!fastStart
          ? <TouchableOpacity style={st.startBtn} onPress={startFast}><Text style={st.btnTxt}>START FAST</Text></TouchableOpacity>
          : <TouchableOpacity style={st.stopBtn} onPress={stopFast}><Text style={[st.btnTxt, { color: '#E57373' }]}>END FAST</Text></TouchableOpacity>
        }
        {fastStart && <Text style={st.stamp}>Started {fmtStamp(fastStart)}</Text>}

        {history.length > 0 && (
          <>
            <Text style={st.histLbl}>RECENT FASTS</Text>
            {history.slice(0, 10).map((h, i) => (
              <View key={i} style={st.histRow}>
                <View>
                  <Text style={st.histDate}>{fmtStamp(h.start)}</Text>
                  <Text style={st.histProto}>{h.protocol}</Text>
                </View>
                <Text style={st.histDur}>{fmtDur(h.duration)}</Text>
              </View>
            ))}
          </>
        )}
      </View>

      <Modal visible={showCustom} transparent animationType="fade" onRequestClose={() => setShowCustom(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={1} onPress={() => setShowCustom(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: mc.card, padding: 24, width: 300, borderWidth: 1, borderColor: mc.border }}>
              <Text style={{ fontFamily: F.serif, fontSize: 16, color: mc.text, marginBottom: 16 }}>Custom Protocol</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 6 }}>Fasting hours</Text>
              <TextInput style={{ borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, color: mc.text, marginBottom: 12 }}
                value={customFast} onChangeText={setCustomFast} keyboardType="number-pad" placeholderTextColor={mc.text3} />
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 6 }}>Eating hours</Text>
              <TextInput style={{ borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, color: mc.text, marginBottom: 16 }}
                value={customEat} onChangeText={setCustomEat} keyboardType="number-pad" placeholderTextColor={mc.text3} />
              <TouchableOpacity style={{ backgroundColor: accentColor, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => {
                  const f = parseInt(customFast) || 16;
                  const e = parseInt(customEat) || 8;
                  setProtocol({ key: 'custom', label: `${f}:${e}`, fast: f, eat: e, desc: `Fast ${f}h · eat in ${e}h window` });
                  setShowCustom(false);
                }}>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700', letterSpacing: 1 }}>SET PROTOCOL</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}
