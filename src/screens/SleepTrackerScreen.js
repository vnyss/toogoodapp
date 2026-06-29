import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import Svg, { Circle, Path, Text as SvgText, Rect, Line } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) { return new Date(iso + 'T12:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }); }
function shortDay(iso) { return new Date(iso + 'T12:00').toLocaleDateString('en', { weekday: 'short' }).slice(0, 2); }
function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

const SLEEP_GOAL = 8;

const QUALITY_OPTS = [
  { value: 1, label: 'Terrible',  emoji: '😫', color: '#E57373' },
  { value: 2, label: 'Poor',      emoji: '😞', color: '#FF8A65' },
  { value: 3, label: 'Fair',      emoji: '😐', color: '#FFB74D' },
  { value: 4, label: 'Good',      emoji: '🙂', color: '#81C784' },
  { value: 5, label: 'Excellent', emoji: '😊', color: '#4CAF7C' },
];

const SLEEP_TAGS = [
  { key: 'stressed',   label: 'Stressed' },
  { key: 'caffeine',   label: 'Caffeine' },
  { key: 'alcohol',    label: 'Alcohol' },
  { key: 'exercise',   label: 'Exercised' },
  { key: 'screen',     label: 'Late Screen' },
  { key: 'travel',     label: 'Travelling' },
  { key: 'nap',        label: 'Napped' },
  { key: 'noise',      label: 'Noisy' },
];

function qualityColor(q) {
  return QUALITY_OPTS.find(o => o.value === q)?.color || '#666';
}
function sleepScore(hours, quality) {
  const hScore = Math.min(hours / SLEEP_GOAL, 1) * 60;
  const qScore = ((quality - 1) / 4) * 40;
  return Math.round(hScore + qScore);
}
function sleepPhaseHint(hours) {
  if (hours < 4) return { phase: 'Sleep deprived', desc: 'Far below recommended 7–9h. Affects memory, mood and immune function.', color: '#E57373' };
  if (hours < 6) return { phase: 'Under-slept', desc: 'Below recommended range. Aim for 7–9 hours for optimal health.', color: '#FF8A65' };
  if (hours < 7) return { phase: 'Near target', desc: 'Getting close. Push for 7+ hours to feel the full benefit.', color: '#FFB74D' };
  if (hours <= 9) return { phase: 'Optimal', desc: 'Within the ideal 7–9h range. Your body and brain will thank you.', color: '#4CAF7C' };
  return { phase: 'Extended sleep', desc: 'Over 9h. Fine occasionally; consistently sleeping >9h may signal an underlying issue.', color: '#7C8BF5' };
}

// ── Score ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score, color, size = 140 }) {
  const C = size / 2, R = C - 14;
  const circ = 2 * Math.PI * R;
  const dash  = circ * (score / 100);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={C} cy={C} r={R} fill="none" stroke="#2a2a2a" strokeWidth={10} />
      <Circle cx={C} cy={C} r={R} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${C} ${C})`} />
      <SvgText x={C} y={C + 6} textAnchor="middle" fontSize={28} fontWeight="700" fill={color}>{score}</SvgText>
      <SvgText x={C} y={C + 22} textAnchor="middle" fontSize={8} fill="#666">SCORE</SvgText>
    </Svg>
  );
}

// ── Week chart ────────────────────────────────────────────────────────────────
function SleepChart({ data, goal, color }) {
  const W = 320, H = 80, pad = 12;
  const barW = Math.floor((W - pad * 2) / data.length) - 4;
  const max  = Math.max(...data.map(d => d.v), goal, 1);
  return (
    <Svg width="100%" height={H + 28} viewBox={`0 0 ${W} ${H + 28}`}>
      <Path d={`M${pad} ${H - (goal / max) * H} H${W - pad}`} stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
      {data.map((d, i) => {
        const x  = pad + i * ((W - pad * 2) / data.length);
        const bH = Math.max(2, Math.round((d.v / max) * H));
        const hit = d.v >= goal;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={H - bH} width={barW} height={bH} fill={hit ? color : color + '55'} rx={2} />
            <SvgText x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize={8} fill="#666">{d.label}</SvgText>
            {d.v > 0 && (
              <SvgText x={x + barW / 2} y={H - bH - 4} textAnchor="middle" fontSize={7} fill={hit ? color : '#555'}>
                {d.v}h
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export default function SleepTrackerScreen() {
  const { mc, accentColor } = useTheme();
  const SLEEP_COLOR = '#7C8BF5';

  const [storageKey, setStorageKey] = useState(null);
  const [allData,    setAllData]    = useState({});
  const [tab,        setTab]        = useState('log');

  // Log form
  const [hours,      setHours]      = useState('');
  const [minutes,    setMinutes]    = useState('0');
  const [quality,    setQuality]    = useState(3);
  const [bedTime,    setBedTime]    = useState('');
  const [wakeTime,   setWakeTime]   = useState('');
  const [tags,       setTags]       = useState([]);
  const [notes,      setNotes]      = useState('');
  const [saved,      setSaved]      = useState(false);

  const today     = todayISO();
  const todayEntry = allData[today];

  useEffect(() => {
    getUser().then(async u => {
      const key = `tg_sleep_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) setAllData(JSON.parse(raw));
    });
  }, []);

  async function persist(newData) {
    if (!storageKey) return;
    await AsyncStorage.setItem(storageKey, JSON.stringify(newData));
  }

  async function saveEntry() {
    const h = parseFloat(hours) + (parseInt(minutes) || 0) / 60;
    if (!h || h <= 0) return;
    const entry = {
      hours: Math.round(h * 10) / 10,
      quality,
      bedTime,
      wakeTime,
      tags,
      notes,
      score: sleepScore(h, quality),
      date: today,
    };
    const newData = { ...allData, [today]: entry };
    setAllData(newData);
    await persist(newData);
    setSaved(true);
    setHours(''); setMinutes('0'); setQuality(3); setBedTime(''); setWakeTime(''); setTags([]); setNotes('');
  }

  function toggleTag(k) {
    setTags(prev => prev.includes(k) ? prev.filter(t => t !== k) : [...prev, k]);
  }

  // Insights
  const weekDays = last7Days();
  const weekData = weekDays.map(iso => ({ label: shortDay(iso), v: allData[iso]?.hours || 0 }));
  const avgHours = (() => {
    const valid = weekDays.map(iso => allData[iso]?.hours).filter(Boolean);
    return valid.length ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length * 10) / 10 : 0;
  })();
  const avgQuality = (() => {
    const valid = weekDays.map(iso => allData[iso]?.quality).filter(Boolean);
    return valid.length ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length * 10) / 10 : 0;
  })();
  const streak = (() => {
    let s = 0; const d = new Date();
    while (true) {
      const iso = d.toISOString().slice(0, 10);
      d.setDate(d.getDate() - 1);
      if (allData[iso]?.hours >= SLEEP_GOAL) s++;
      else break;
      if (s > 30) break;
    }
    return s;
  })();

  const histDays = Object.entries(allData).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  const phaseHint = todayEntry ? sleepPhaseHint(todayEntry.hours) : null;

  function sleepTip(tags) {
    if (tags.includes('caffeine')) return '☕ Avoid caffeine after 2pm — it stays in your system for 8+ hours.';
    if (tags.includes('screen'))   return '📱 Blue light suppresses melatonin. Try stopping screens 1h before bed.';
    if (tags.includes('alcohol'))  return '🍷 Alcohol disrupts REM sleep and reduces sleep quality.';
    if (tags.includes('stressed')) return '🧘 Try 4-7-8 breathing before bed to lower cortisol.';
    if (tags.includes('exercise')) return '💪 Exercise improves deep sleep — just avoid intense workouts within 2h of bedtime.';
    return '💤 Consistent sleep/wake times are the single biggest factor in sleep quality.';
  }

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 16, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
    tabs:    { flexDirection: 'row', gap: 6, marginBottom: 20 },
    tab:     { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    tabA:    { borderColor: SLEEP_COLOR, backgroundColor: SLEEP_COLOR + '18' },
    tabTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    tabTxA:  { color: SLEEP_COLOR },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 10 },
    input:   { borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, fontSize: 14, color: mc.text },
    row:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
    field:   { flex: 1 },
    flabel:  { fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 4 },
    saveBtn: { backgroundColor: SLEEP_COLOR, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    saveTxt: { fontFamily: F.mono, fontSize: 12, color: '#fff', fontWeight: '700', letterSpacing: 1 },
    qrow:    { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
    qopt:    { flex: 1, alignItems: 'center', paddingVertical: 10, borderWidth: 1, borderColor: mc.border },
    qoptA:   { borderWidth: 2 },
    qemoji:  { fontSize: 20 },
    qlabel:  { fontFamily: F.mono, fontSize: 8, color: mc.text3, marginTop: 4 },
    tagRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag:     { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: mc.border },
    tagA:    { borderColor: SLEEP_COLOR, backgroundColor: SLEEP_COLOR + '18' },
    tagTxt:  { fontFamily: F.mono, fontSize: 10, color: mc.text3 },
    tagTxA:  { color: SLEEP_COLOR },
    statRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
    statVal: { fontFamily: F.mono, fontSize: 24, fontWeight: '700', color: SLEEP_COLOR, textAlign: 'center' },
    statLbl: { fontFamily: F.mono, fontSize: 9, color: mc.text3, textAlign: 'center', marginTop: 2 },
    hrow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
  });

  const dateInput = (label, value, onChange, placeholder) => (
    <View style={s.field}>
      <Text style={s.flabel}>{label}</Text>
      {React.createElement('input', {
        type: 'time',
        value,
        onChange: e => onChange(e.target.value),
        style: { backgroundColor: 'transparent', color: mc.text, fontFamily: F.mono, fontSize: 13, border: `1px solid ${mc.border}`, padding: 10, width: '100%', boxSizing: 'border-box' },
      })}
    </View>
  );

  const TABS = [{ k: 'log', l: 'Log Sleep' }, { k: 'insights', l: 'Insights' }, { k: 'history', l: 'History' }];

  return (
    <ScrollView style={s.root} keyboardShouldPersistTaps="handled">
      <View style={s.content}>
        <Text style={s.title}>Sleep Tracker</Text>
        <Text style={s.sub}>RECOVERY & REST</Text>

        <View style={s.tabs}>
          {TABS.map(t => (
            <TouchableOpacity key={t.k} style={[s.tab, tab === t.k && s.tabA]} onPress={() => { setTab(t.k); setSaved(false); }}>
              <Text style={[s.tabTxt, tab === t.k && s.tabTxA]}>{t.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── LOG ── */}
        {tab === 'log' && (
          <>
            {todayEntry && !saved && (
              <View style={{ borderWidth: 1, borderColor: SLEEP_COLOR + '44', backgroundColor: SLEEP_COLOR + '11', padding: 12, marginBottom: 14 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: SLEEP_COLOR }}>
                  Today's sleep already logged: {todayEntry.hours}h · Score {todayEntry.score}/100. Log again to update.
                </Text>
              </View>
            )}
            {saved && (
              <View style={{ borderWidth: 1, borderColor: '#4CAF7C44', backgroundColor: '#4CAF7C11', padding: 12, marginBottom: 14 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#4CAF7C' }}>Sleep logged ✓</Text>
              </View>
            )}

            <View style={s.card}>
              <Text style={s.label}>SLEEP DURATION</Text>
              <View style={s.row}>
                <View style={s.field}>
                  <Text style={s.flabel}>HOURS</Text>
                  <TextInput style={s.input} value={hours} onChangeText={setHours} keyboardType="decimal-pad" placeholder="7" placeholderTextColor={mc.text3} />
                </View>
                <View style={s.field}>
                  <Text style={s.flabel}>MINUTES</Text>
                  <TextInput style={s.input} value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="30" placeholderTextColor={mc.text3} />
                </View>
              </View>
              <View style={s.row}>
                {dateInput('BED TIME', bedTime, setBedTime, '22:30')}
                {dateInput('WAKE TIME', wakeTime, setWakeTime, '06:30')}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.label}>SLEEP QUALITY</Text>
              <View style={s.qrow}>
                {QUALITY_OPTS.map(o => (
                  <TouchableOpacity key={o.value} style={[s.qopt, quality === o.value && { ...s.qoptA, borderColor: o.color }]} onPress={() => setQuality(o.value)}>
                    <Text style={s.qemoji}>{o.emoji}</Text>
                    <Text style={[s.qlabel, quality === o.value && { color: o.color }]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.label}>FACTORS (SELECT ALL THAT APPLY)</Text>
              <View style={s.tagRow}>
                {SLEEP_TAGS.map(t => (
                  <TouchableOpacity key={t.key} style={[s.tag, tags.includes(t.key) && s.tagA]} onPress={() => toggleTag(t.key)}>
                    <Text style={[s.tagTxt, tags.includes(t.key) && s.tagTxA]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.label}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={[s.input, { height: 70, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Anything that affected your sleep…"
                placeholderTextColor={mc.text3}
              />
            </View>

            <TouchableOpacity style={s.saveBtn} onPress={saveEntry}>
              <Text style={s.saveTxt}>SAVE SLEEP LOG</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── INSIGHTS ── */}
        {tab === 'insights' && (
          <>
            {todayEntry ? (
              <>
                <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 20 }]}>
                  <ScoreRing score={todayEntry.score} color={qualityColor(todayEntry.quality)} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 4 }}>LAST NIGHT</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 28, color: SLEEP_COLOR, fontWeight: '700' }}>{todayEntry.hours}h</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: qualityColor(todayEntry.quality) }}>
                      {QUALITY_OPTS.find(o => o.value === todayEntry.quality)?.label} quality
                    </Text>
                    {todayEntry.bedTime && (
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 4 }}>
                        {todayEntry.bedTime} → {todayEntry.wakeTime}
                      </Text>
                    )}
                  </View>
                </View>
                {phaseHint && (
                  <View style={{ borderWidth: 1, borderColor: phaseHint.color + '44', backgroundColor: phaseHint.color + '11', padding: 14, marginBottom: 14 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: phaseHint.color, fontWeight: '700', marginBottom: 4 }}>{phaseHint.phase}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, lineHeight: 18 }}>{phaseHint.desc}</Text>
                  </View>
                )}
                {todayEntry.tags?.length > 0 && (
                  <View style={{ borderWidth: 1, borderColor: mc.border, padding: 14, marginBottom: 14 }}>
                    <Text style={s.label}>SLEEP TIP</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, lineHeight: 18 }}>
                      {sleepTip(todayEntry.tags)}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={s.card}>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>Log last night's sleep to see your insights.</Text>
              </View>
            )}

            <View style={s.card}>
              <Text style={s.label}>7-DAY SLEEP CHART (DASHED = 8H GOAL)</Text>
              <SleepChart data={weekData} goal={SLEEP_GOAL} color={SLEEP_COLOR} />
            </View>

            <View style={s.card}>
              <Text style={s.label}>7-DAY AVERAGES</Text>
              <View style={s.statRow}>
                <View>
                  <Text style={s.statVal}>{avgHours}h</Text>
                  <Text style={s.statLbl}>AVG SLEEP</Text>
                </View>
                <View>
                  <Text style={[s.statVal, { color: qualityColor(Math.round(avgQuality)) }]}>{avgQuality}</Text>
                  <Text style={s.statLbl}>AVG QUALITY</Text>
                </View>
                <View>
                  <Text style={[s.statVal, { color: '#FFB74D' }]}>{streak}</Text>
                  <Text style={s.statLbl}>DAY STREAK 🔥</Text>
                </View>
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.label}>SLEEP DEBT</Text>
              {(() => {
                const debt = Math.max(0, SLEEP_GOAL * 7 - weekData.reduce((s, d) => s + d.v, 0));
                return (
                  <>
                    <Text style={{ fontFamily: F.mono, fontSize: 32, fontWeight: '700', color: debt > 5 ? '#E57373' : debt > 2 ? '#FFB74D' : '#4CAF7C' }}>
                      {debt.toFixed(1)}h
                    </Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginTop: 4 }}>
                      {debt === 0 ? 'No sleep debt this week. Well rested!' : `This week you\'re ${debt.toFixed(1)}h short of the 56h weekly target (8h/night).`}
                    </Text>
                  </>
                );
              })()}
            </View>
          </>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <View style={s.card}>
            <Text style={s.label}>SLEEP HISTORY</Text>
            {histDays.length === 0
              ? <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>No entries yet. Log your first sleep!</Text>
              : histDays.map(([iso, e]) => {
                  const qObj = QUALITY_OPTS.find(o => o.value === e.quality);
                  return (
                    <View key={iso} style={s.hrow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{fmtDate(iso)}</Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>
                          {qObj?.emoji} {qObj?.label}{e.bedTime ? `  ·  ${e.bedTime}–${e.wakeTime}` : ''}
                        </Text>
                        {e.tags?.length > 0 && (
                          <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{e.tags.join(', ')}</Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 16, color: SLEEP_COLOR, fontWeight: '700' }}>{e.hours}h</Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 10, color: qualityColor(e.quality) }}>Score {e.score}</Text>
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
