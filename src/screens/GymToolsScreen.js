import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';

// ── 1RM Formulas ─────────────────────────────────────────────────────────────
function epley(w, r)    { return r === 1 ? w : Math.round(w * (1 + r / 30)); }
function brzycki(w, r)  { return r >= 37 ? w : Math.round(w * (36 / (37 - r))); }
function lombardi(w, r) { return Math.round(w * Math.pow(r, 0.10)); }

// ── Plates calculator ─────────────────────────────────────────────────────────
const PLATE_SIZES_KG  = [25, 20, 15, 10, 5, 2.5, 1.25];
const PLATE_SIZES_LBS = [45, 35, 25, 10, 5, 2.5];

function calcPlates(target, barWeight, unit) {
  const sizes = unit === 'lbs' ? PLATE_SIZES_LBS : PLATE_SIZES_KG;
  let remaining = (parseFloat(target) - parseFloat(barWeight)) / 2;
  if (remaining <= 0) return [];
  const result = [];
  for (const plate of sizes) {
    const count = Math.floor(remaining / plate);
    if (count > 0) { result.push({ plate, count }); remaining -= count * plate; remaining = Math.round(remaining * 1000) / 1000; }
  }
  return result;
}

// ── Body measurements ─────────────────────────────────────────────────────────
const MEASUREMENTS = [
  { key: 'chest',   label: 'Chest' },
  { key: 'waist',   label: 'Waist' },
  { key: 'hips',    label: 'Hips' },
  { key: 'neck',    label: 'Neck' },
  { key: 'biceps',  label: 'Biceps' },
  { key: 'thighs',  label: 'Thighs' },
  { key: 'calves',  label: 'Calves' },
  { key: 'shoulder',label: 'Shoulders' },
];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  return new Date(iso + 'T12:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GymToolsScreen() {
  const { mc, accentColor } = useTheme();
  const [activeTab, setActiveTab] = useState('orm');

  // 1RM
  const [ormWeight, setOrmWeight] = useState('');
  const [ormReps,   setOrmReps]   = useState('');

  // Plates
  const [targetW,  setTargetW]  = useState('');
  const [barW,     setBarW]     = useState('20');
  const [plUnit,   setPlUnit]   = useState('kg');
  const plates = targetW ? calcPlates(targetW, barW, plUnit) : [];

  // Body measurements
  const [measurements, setMeasurements] = useState({});
  const [savedMeas,    setSavedMeas]    = useState([]);
  const [storageKey,   setStorageKey]   = useState(null);
  const [measUnit,     setMeasUnit]     = useState('cm');

  useEffect(() => {
    getUser().then(async u => {
      const key = `tg_measurements_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) setSavedMeas(JSON.parse(raw));
    });
  }, []);

  async function saveMeasurements() {
    const filled = Object.entries(measurements).filter(([, v]) => v);
    if (!filled.length) return;
    const entry = { date: todayISO(), unit: measUnit, ...measurements };
    const updated = [entry, ...savedMeas.filter(m => m.date !== todayISO())].slice(0, 60);
    setSavedMeas(updated);
    if (storageKey) await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    setMeasurements({});
  }

  const w   = parseFloat(ormWeight) || 0;
  const rps = parseInt(ormReps) || 0;
  const orm_epley    = (w && rps) ? epley(w, rps) : null;
  const orm_brzycki  = (w && rps) ? brzycki(w, rps) : null;
  const orm_lombardi = (w && rps) ? lombardi(w, rps) : null;
  const avg1RM = orm_epley ? Math.round((orm_epley + orm_brzycki + orm_lombardi) / 3) : null;

  // Percentage table (50%–100% of estimated 1RM)
  const pctTable = avg1RM
    ? [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50].map(pct => ({
        pct,
        weight: Math.round(avg1RM * pct / 100 * 4) / 4,
        reps: pct >= 95 ? 1 : pct >= 90 ? 2 : pct >= 85 ? 3 : pct >= 80 ? 4 : pct >= 75 ? 6 : pct >= 70 ? 8 : pct >= 65 ? 10 : pct >= 60 ? 12 : pct >= 55 ? 15 : pct >= 50 ? 20 : 25,
      }))
    : [];

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 16, maxWidth: 560, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
    tabs:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 20 },
    tab:     { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    tabA:    { borderColor: accentColor, backgroundColor: accentColor + '18' },
    tabTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    tabTxA:  { color: accentColor },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 8 },
    row:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
    field:   { flex: 1 },
    flabel:  { fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 4 },
    input:   { borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, fontSize: 14, color: mc.text },
    result:  { fontFamily: F.mono, fontSize: 36, fontWeight: '700', color: accentColor },
    resultSub:{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 2 },
    pctRow:  { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: mc.border },
    pctPct:  { fontFamily: F.mono, fontSize: 11, color: mc.text3, width: 45 },
    pctWt:   { fontFamily: F.mono, fontSize: 13, color: mc.text, flex: 1 },
    pctReps: { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    plateRow:{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    plateLbl:{ fontFamily: F.mono, fontSize: 12, color: mc.text, width: 70 },
    saveBtn: { backgroundColor: accentColor, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
    saveTxt: { fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700', letterSpacing: 1 },
    measRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    measLbl: { fontFamily: F.mono, fontSize: 11, color: mc.text2, width: 80, paddingTop: 10 },
    histRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
    histDate:{ fontFamily: F.mono, fontSize: 11, color: mc.text, marginBottom: 4 },
    histMeas:{ fontFamily: F.mono, fontSize: 10, color: mc.text3, flexDirection: 'row', flexWrap: 'wrap' },
  });

  const TABS = [
    { key: 'orm',    label: '1RM Calc' },
    { key: 'plates', label: 'Plates' },
    { key: 'body',   label: 'Body Measurements' },
  ];

  return (
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>Gym Tools</Text>
        <Text style={s.sub}>CALCULATORS & BODY TRACKING</Text>

        <View style={s.tabs}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabA]} onPress={() => setActiveTab(t.key)}>
              <Text style={[s.tabTxt, activeTab === t.key && s.tabTxA]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 1RM CALCULATOR */}
        {activeTab === 'orm' && (
          <>
            <View style={s.card}>
              <Text style={s.label}>1RM CALCULATOR (ONE REP MAX)</Text>
              <View style={s.row}>
                <View style={s.field}>
                  <Text style={s.flabel}>WEIGHT (KG)</Text>
                  <TextInput style={s.input} value={ormWeight} onChangeText={setOrmWeight} keyboardType="decimal-pad" placeholder="e.g. 80" placeholderTextColor={mc.text3} />
                </View>
                <View style={s.field}>
                  <Text style={s.flabel}>REPS COMPLETED</Text>
                  <TextInput style={s.input} value={ormReps} onChangeText={setOrmReps} keyboardType="number-pad" placeholder="e.g. 5" placeholderTextColor={mc.text3} />
                </View>
              </View>
              {avg1RM && (
                <>
                  <Text style={s.result}>{avg1RM} kg</Text>
                  <Text style={s.resultSub}>Estimated 1RM (average of 3 formulas)</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 6 }}>
                    Epley: {orm_epley} · Brzycki: {orm_brzycki} · Lombardi: {orm_lombardi}
                  </Text>
                </>
              )}
            </View>

            {/* Percentage table */}
            {pctTable.length > 0 && (
              <View style={s.card}>
                <Text style={s.label}>TRAINING PERCENTAGES</Text>
                <View style={[s.pctRow, { marginBottom: 6 }]}>
                  <Text style={[s.pctPct, { color: mc.text3 }]}>%</Text>
                  <Text style={[s.pctWt, { color: mc.text3 }]}>Weight</Text>
                  <Text style={[s.pctReps, { color: mc.text3 }]}>~Reps</Text>
                </View>
                {pctTable.map(({ pct, weight, reps }) => (
                  <View key={pct} style={s.pctRow}>
                    <Text style={s.pctPct}>{pct}%</Text>
                    <Text style={s.pctWt}>{weight} kg</Text>
                    <Text style={s.pctReps}>{reps}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* PLATES CALCULATOR */}
        {activeTab === 'plates' && (
          <View style={s.card}>
            <Text style={s.label}>PLATES CALCULATOR</Text>
            <View style={s.row}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {['kg', 'lbs'].map(u => (
                  <TouchableOpacity key={u} style={[s.tab, plUnit === u && s.tabA]} onPress={() => setPlUnit(u)}>
                    <Text style={[s.tabTxt, plUnit === u && s.tabTxA]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={s.row}>
              <View style={s.field}>
                <Text style={s.flabel}>TARGET WEIGHT ({plUnit})</Text>
                <TextInput style={s.input} value={targetW} onChangeText={setTargetW} keyboardType="decimal-pad" placeholder={plUnit === 'kg' ? '100' : '225'} placeholderTextColor={mc.text3} />
              </View>
              <View style={s.field}>
                <Text style={s.flabel}>BAR WEIGHT ({plUnit})</Text>
                <TextInput style={s.input} value={barW} onChangeText={setBarW} keyboardType="decimal-pad" placeholder={plUnit === 'kg' ? '20' : '45'} placeholderTextColor={mc.text3} />
              </View>
            </View>

            {plates.length > 0 ? (
              <>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 12 }}>
                  Load each side of the bar with:
                </Text>
                {plates.map(({ plate, count }) => (
                  <View key={plate} style={s.plateRow}>
                    <Text style={s.plateLbl}>{plate} {plUnit}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {Array.from({ length: count }).map((_, i) => (
                        <View key={i} style={{ width: 36, height: 36, borderWidth: 2, borderColor: accentColor, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: F.mono, fontSize: 9, color: accentColor, fontWeight: '700' }}>{plate}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginLeft: 10 }}>× {count}</Text>
                  </View>
                ))}
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: accentColor, marginTop: 10 }}>
                  Total: {targetW} {plUnit}
                </Text>
              </>
            ) : targetW ? (
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>
                Target weight must be greater than bar weight.
              </Text>
            ) : null}
          </View>
        )}

        {/* BODY MEASUREMENTS */}
        {activeTab === 'body' && (
          <>
            <View style={s.card}>
              <Text style={s.label}>LOG TODAY'S MEASUREMENTS</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {['cm', 'in'].map(u => (
                  <TouchableOpacity key={u} style={[s.tab, measUnit === u && s.tabA]} onPress={() => setMeasUnit(u)}>
                    <Text style={[s.tabTxt, measUnit === u && s.tabTxA]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {MEASUREMENTS.map(m => (
                  <View key={m.key} style={{ width: '46%' }}>
                    <Text style={s.flabel}>{m.label} ({measUnit})</Text>
                    <TextInput
                      style={s.input}
                      value={measurements[m.key] || ''}
                      onChangeText={v => setMeasurements(prev => ({ ...prev, [m.key]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={mc.text3}
                    />
                  </View>
                ))}
              </View>
              <TouchableOpacity style={s.saveBtn} onPress={saveMeasurements}>
                <Text style={s.saveTxt}>SAVE MEASUREMENTS</Text>
              </TouchableOpacity>
            </View>

            {savedMeas.length > 0 && (
              <View style={s.card}>
                <Text style={s.label}>MEASUREMENT HISTORY</Text>
                {savedMeas.slice(0, 10).map((entry, i) => (
                  <View key={i} style={s.histRow}>
                    <Text style={s.histDate}>{fmtDate(entry.date)}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>
                      {MEASUREMENTS
                        .filter(m => entry[m.key])
                        .map(m => `${m.label}: ${entry[m.key]}${entry.unit || 'cm'}`)
                        .join('  ·  ')}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
