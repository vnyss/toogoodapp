import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser, getToken } from '../auth';
import { API_BASE } from '../config';

const PHASES = [
  { key: 'menstruation', label: 'Menstruation',  days: '1–5',   color: '#E57373', desc: 'Bleeding phase. Rest & iron-rich foods recommended.' },
  { key: 'follicular',   label: 'Follicular',    days: '6–13',  color: '#FFB74D', desc: 'Energy rising. Good time for strength training.' },
  { key: 'ovulation',    label: 'Ovulation',     days: '14',    color: '#4CAF7C', desc: 'Peak energy. Best performance window.' },
  { key: 'luteal',       label: 'Luteal',        days: '15–28', color: '#7C8BF5', desc: 'Energy dipping. Focus on recovery & stress relief.' },
];

const SYMPTOMS = ['Cramps', 'Bloating', 'Headache', 'Fatigue', 'Mood swings', 'Tender breasts', 'Acne', 'Back pain'];

const FLOW = ['Light', 'Medium', 'Heavy'];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  return new Date(iso + 'T12:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export default function PeriodScreen() {
  const { mc, accentColor } = useTheme();
  const [gender,       setGender]       = useState(null);   // null = loading
  const [lastPeriod,   setLastPeriod]   = useState('');
  const [cycleLen,     setCycleLen]     = useState(28);
  const [periodLen,    setPeriodLen]    = useState(5);
  const [symptoms,     setSymptoms]     = useState([]);
  const [flow,         setFlow]         = useState('Medium');
  const [logs,         setLogs]         = useState([]);     // array of {date, symptoms, flow}
  const [storageKey,   setStorageKey]   = useState(null);

  useEffect(() => {
    async function load() {
      const token = await getToken();
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
      try {
        const res = await fetch(API_BASE + '/api/v1/me', { headers });
        const data = await res.json();
        setGender((data.gender || '').toLowerCase());
      } catch {
        setGender('unknown');
      }

      const u = await getUser();
      const key = `tg_period_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.lastPeriod) setLastPeriod(d.lastPeriod);
        if (d.cycleLen)   setCycleLen(d.cycleLen);
        if (d.periodLen)  setPeriodLen(d.periodLen);
        if (d.logs)       setLogs(d.logs);
      }
    }
    load();
  }, []);

  async function persist(patch) {
    if (!storageKey) return;
    const d = { lastPeriod, cycleLen, periodLen, logs, ...patch };
    await AsyncStorage.setItem(storageKey, JSON.stringify(d));
  }

  function setLastPeriodAndSave(v) { setLastPeriod(v); persist({ lastPeriod: v }); }
  function setCycleLenAndSave(v)   { setCycleLen(v);   persist({ cycleLen: v }); }

  function logToday() {
    const today = todayISO();
    const entry = { date: today, symptoms, flow };
    const updated = [entry, ...logs.filter(l => l.date !== today)].slice(0, 60);
    setLogs(updated);
    persist({ logs: updated });
    setSymptoms([]); setFlow('Medium');
  }

  function toggleSymptom(s) {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  const today = todayISO();
  let cycleDay = 0, currentPhase = null, nextPeriod = '', daysUntil = null;

  if (lastPeriod) {
    cycleDay = daysBetween(lastPeriod, today) + 1;
    const posInCycle = ((cycleDay - 1) % cycleLen) + 1;
    if (posInCycle <= periodLen)               currentPhase = PHASES[0];
    else if (posInCycle <= cycleLen / 2 - 1)   currentPhase = PHASES[1];
    else if (posInCycle <= cycleLen / 2 + 1)   currentPhase = PHASES[2];
    else                                        currentPhase = PHASES[3];

    const lastStart = new Date(lastPeriod + 'T12:00');
    const cycleSince = Math.floor(daysBetween(lastPeriod, today) / cycleLen);
    const nextStart  = addDays(lastPeriod, (cycleSince + 1) * cycleLen);
    nextPeriod = nextStart;
    daysUntil  = daysBetween(today, nextStart);
  }

  const predictions = lastPeriod
    ? Array.from({ length: 3 }, (_, i) => {
        const d = addDays(lastPeriod, (Math.floor(daysBetween(lastPeriod, today) / cycleLen) + i + 1) * cycleLen);
        return d;
      })
    : [];

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 20, maxWidth: 560, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 24 },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 16 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 8 },
    row:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    chip:    { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: mc.border },
    chipA:   { borderColor: accentColor, backgroundColor: accentColor + '18' },
    chipTxt: { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    chipTxA: { color: accentColor },
    datBtn:  { borderWidth: 1, borderColor: mc.border, padding: 10 },
    datTxt:  { fontFamily: F.mono, fontSize: 13, color: mc.text },
    saveBtn: { backgroundColor: accentColor, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
    saveTxt: { fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700', letterSpacing: 1 },
  });

  if (gender === null) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>Loading…</Text>
      </View>
    );
  }

  if (gender && gender !== 'female' && gender !== 'unknown' && gender !== '') {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>🚫</Text>
        <Text style={{ fontFamily: F.serif, fontSize: 18, color: mc.text, textAlign: 'center', marginBottom: 8 }}>
          This feature is for female users
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, textAlign: 'center' }}>
          Period tracking is only available for female users.{'\n'}Update your gender in Profile → Settings if needed.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>Period Tracker</Text>
        <Text style={s.sub}>CYCLE TRACKING & PREDICTIONS</Text>

        {/* Current status */}
        {lastPeriod && currentPhase && (
          <View style={[s.card, { borderColor: currentPhase.color + '60', backgroundColor: currentPhase.color + '08' }]}>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: currentPhase.color, letterSpacing: 1, marginBottom: 6 }}>
              CURRENT PHASE
            </Text>
            <Text style={{ fontFamily: F.serif, fontSize: 20, color: mc.text, marginBottom: 4 }}>{currentPhase.label}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>{currentPhase.desc}</Text>
            <View style={{ flexDirection: 'row', gap: 24, marginTop: 12 }}>
              <View>
                <Text style={{ fontFamily: F.mono, fontSize: 22, color: currentPhase.color, fontWeight: '700' }}>{cycleDay}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>CYCLE DAY</Text>
              </View>
              <View>
                <Text style={{ fontFamily: F.mono, fontSize: 22, color: mc.text, fontWeight: '700' }}>{daysUntil ?? '—'}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>DAYS TO NEXT</Text>
              </View>
            </View>
          </View>
        )}

        {/* Phase timeline */}
        {lastPeriod && (
          <View style={[s.card, { marginBottom: 16 }]}>
            <Text style={s.label}>PHASE OVERVIEW</Text>
            {PHASES.map((ph, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ph.color, marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{ph.label}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>Day {ph.days}</Text>
                </View>
                {currentPhase?.key === ph.key && (
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: ph.color }}>← you are here</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Last period date */}
        <View style={s.card}>
          <Text style={s.label}>LAST PERIOD START DATE</Text>
          {Platform.OS === 'web' ? (
            React.createElement('input', {
              type: 'date',
              value: lastPeriod || '',
              max: today,
              onChange: e => setLastPeriodAndSave(e.target.value),
              style: { fontFamily: 'Courier Prime, monospace', fontSize: 13, background: 'transparent', border: `1px solid ${mc.border}`, padding: 10, color: mc.text, width: '100%', boxSizing: 'border-box' },
            })
          ) : (
            <TouchableOpacity style={s.datBtn}>
              <Text style={s.datTxt}>{lastPeriod || 'Tap to set date'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Settings */}
        <View style={s.card}>
          <Text style={s.label}>CYCLE LENGTH (DAYS)</Text>
          <View style={s.row}>
            {[21, 24, 26, 28, 30, 32, 35].map(n => (
              <TouchableOpacity key={n} style={[s.chip, cycleLen === n && s.chipA]} onPress={() => setCycleLenAndSave(n)}>
                <Text style={[s.chipTxt, cycleLen === n && s.chipTxA]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.label, { marginTop: 8 }]}>PERIOD LENGTH (DAYS)</Text>
          <View style={s.row}>
            {[3, 4, 5, 6, 7].map(n => (
              <TouchableOpacity key={n} style={[s.chip, periodLen === n && s.chipA]} onPress={() => setPeriodLen(n)}>
                <Text style={[s.chipTxt, periodLen === n && s.chipTxA]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Symptom log */}
        <View style={s.card}>
          <Text style={s.label}>LOG TODAY'S SYMPTOMS</Text>
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            {SYMPTOMS.map(sym => (
              <TouchableOpacity key={sym} style={[s.chip, symptoms.includes(sym) && s.chipA]} onPress={() => toggleSymptom(sym)}>
                <Text style={[s.chipTxt, symptoms.includes(sym) && s.chipTxA]}>{sym}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.label, { marginTop: 12 }]}>FLOW</Text>
          <View style={s.row}>
            {FLOW.map(f => (
              <TouchableOpacity key={f} style={[s.chip, flow === f && s.chipA]} onPress={() => setFlow(f)}>
                <Text style={[s.chipTxt, flow === f && s.chipTxA]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.saveBtn} onPress={logToday}>
            <Text style={s.saveTxt}>SAVE TODAY'S LOG</Text>
          </TouchableOpacity>
        </View>

        {/* Predictions */}
        {predictions.length > 0 && (
          <View style={s.card}>
            <Text style={s.label}>UPCOMING PERIODS (PREDICTED)</Text>
            {predictions.map((d, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: mc.border }}>
                <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text }}>{fmtDate(d)}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>
                  {daysBetween(today, d) > 0 ? `in ${daysBetween(today, d)} days` : 'today'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* History */}
        {logs.length > 0 && (
          <View style={s.card}>
            <Text style={s.label}>RECENT LOGS</Text>
            {logs.slice(0, 7).map((l, i) => (
              <View key={i} style={{ paddingVertical: 8, borderBottomWidth: i < logs.slice(0,7).length - 1 ? 1 : 0, borderBottomColor: mc.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{fmtDate(l.date)}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor }}>Flow: {l.flow}</Text>
                </View>
                {l.symptoms?.length > 0 && (
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 2 }}>
                    {l.symptoms.join(' · ')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
