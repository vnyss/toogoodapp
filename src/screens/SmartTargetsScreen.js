import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser, getToken } from '../auth';
import { API_BASE } from '../config';
import { smoothWeightTrend, estimateAdaptiveTDEE, detectPhase, recommendTargets, predictGoalDate } from '../lib/adaptiveCoach';
import { getCyclePhase, PHASE_KCAL_ADJUST } from '../lib/cyclePhase';

const GOALS = [
  { key: 'lose',     label: 'Lose weight' },
  { key: 'maintain', label: 'Maintain' },
  { key: 'gain',     label: 'Gain muscle' },
];

const PHASE_LABEL = { cutting: 'Cutting', bulking: 'Bulking', maintaining: 'Maintaining' };
const PHASE_COLOR = { cutting: '#4CAF7C', bulking: '#5B9DD9', maintaining: '#C9A84C' };

function TrendChart({ points, color, mc }) {
  if (points.length < 2) return null;
  const W = 320, H = 120, pad = 10;
  const weights = points.map(p => p.trend);
  const min = Math.min(...weights), max = Math.max(...weights);
  const range = Math.max(max - min, 0.5);
  const x = i => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = w => H - pad - ((w - min) / range) * (H - pad * 2);

  const trendStr = points.map((p, i) => `${x(i)},${y(p.trend)}`).join(' ');
  const rawStr   = points.map((p, i) => `${x(i)},${y(p.raw)}`).join(' ');

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke={mc.border} strokeWidth={1} />
      <Polyline points={rawStr} fill="none" stroke={mc.text3} strokeWidth={1} opacity={0.5} />
      <Polyline points={trendStr} fill="none" stroke={color} strokeWidth={2.2} />
      <Circle cx={x(points.length - 1)} cy={y(points[points.length - 1].trend)} r={3.5} fill={color} />
    </Svg>
  );
}

export default function SmartTargetsScreen() {
  const { mc, accentColor } = useTheme();
  const [goal,      setGoal]      = useState('maintain');
  const [profile,   setProfile]   = useState({});
  const [history,   setHistory]   = useState([]);
  const [storageKey,setStorageKey]= useState(null);
  const [username,  setUsername]  = useState(null);
  const [cyclePhase,setCyclePhase]= useState(null);

  useEffect(() => {
    async function load() {
      const u = await getUser();
      setUsername(u);
      const key = `tg_smart_targets_${u}`;
      setStorageKey(key);
      const saved = await AsyncStorage.getItem(key);
      if (saved) { const d = JSON.parse(saved); if (d.goal) setGoal(d.goal); }

      const raw = await AsyncStorage.getItem(`toogood_daily_logs_${u}`);
      if (raw) setHistory(JSON.parse(raw));

      const periodRaw = await AsyncStorage.getItem(`tg_period_${u}`);
      if (periodRaw) {
        const pd = JSON.parse(periodRaw);
        if (pd.lastPeriod) setCyclePhase(getCyclePhase(pd));
      }

      try {
        const token = await getToken();
        const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
        const res = await fetch(API_BASE + '/api/v1/me', { headers });
        setProfile(await res.json());
      } catch {}
    }
    load();
  }, []);

  async function changeGoal(g) {
    setGoal(g);
    if (storageKey) await AsyncStorage.setItem(storageKey, JSON.stringify({ goal: g }));
  }

  const w = parseFloat(profile.weight_kg) || 70;
  const h = parseFloat(profile.height_cm) || 170;
  const a = parseInt(profile.age) || 25;
  const targetWeight = parseFloat(profile.target_weight_kg) || null;
  const bmr = 10 * w + 6.25 * h - 5 * a + (profile.gender === 'female' ? -161 : 5);
  const formulaTDEE = Math.round(bmr * 1.55);

  const weightPts = history.filter(d => d.weight && parseFloat(d.weight) > 0)
    .map(d => ({ date: d.date, weight: parseFloat(d.weight) }))
    .sort((x, y) => x.date.localeCompare(y.date))
    .slice(-60);
  const trendPts = smoothWeightTrend(weightPts);
  const adaptive = estimateAdaptiveTDEE(history, formulaTDEE);
  const { phase, ratePerWeek } = detectPhase(trendPts);
  const cycleKcalAdjust = PHASE_KCAL_ADJUST[cyclePhase] || 0;
  const targets = recommendTargets(adaptive.tdee, goal, w, cycleKcalAdjust);
  const currentTrend = trendPts.length ? trendPts[trendPts.length - 1].trend : w;
  const goalDate = predictGoalDate(currentTrend, targetWeight, ratePerWeek);

  // Publish computed targets so LogScreen & Dashboard can read them without recalculating
  useEffect(() => {
    if (!username || !targets.calories) return;
    AsyncStorage.setItem(`tg_computed_targets_${username}`, JSON.stringify({
      calories: targets.calories, protein: targets.protein,
      carbs: targets.carbs, fat: targets.fat, goal, updatedAt: Date.now(),
    })).catch(() => {});
  }, [username, targets.calories, targets.protein, targets.carbs, targets.fat, goal]);

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 20, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 10 },
    row:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
    chip:    { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    chipA:   { borderColor: accentColor, backgroundColor: accentColor + '18' },
    chipTxt: { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    chipTxA: { color: accentColor },
    stat:    { fontFamily: F.mono, fontSize: 30, color: accentColor, fontWeight: '700' },
    statSub: { fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 2 },
    macroRow:{ flexDirection: 'row', gap: 20, marginTop: 14, flexWrap: 'wrap' },
    macroV:  { fontFamily: F.mono, fontSize: 16, color: mc.text },
    macroL:  { fontFamily: F.mono, fontSize: 9, color: mc.text3, marginTop: 2 },
    note:    { fontFamily: F.mono, fontSize: 11, color: mc.text3, lineHeight: 17, marginTop: 10 },
  });

  return (
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>Smart Targets</Text>
        <Text style={s.sub}>ADAPTIVE TDEE FROM YOUR ACTUAL TREND</Text>

        <View style={s.card}>
          <Text style={s.label}>YOUR GOAL</Text>
          <View style={s.row}>
            {GOALS.map(g => (
              <TouchableOpacity key={g.key} style={[s.chip, goal === g.key && s.chipA]} onPress={() => changeGoal(g.key)}>
                <Text style={[s.chipTxt, goal === g.key && s.chipTxA]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={s.label}>ESTIMATED EXPENDITURE</Text>
              <Text style={s.stat}>{adaptive.tdee.toLocaleString()}</Text>
              <Text style={s.statSub}>kcal/day · {adaptive.source === 'trend' ? `from your last ${adaptive.spanDays} days` : 'formula estimate (log weight + food to refine)'}</Text>
            </View>
            <View style={{ backgroundColor: PHASE_COLOR[phase] + '22', borderWidth: 1, borderColor: PHASE_COLOR[phase] + '55', paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: PHASE_COLOR[phase] }}>{PHASE_LABEL[phase]}</Text>
            </View>
          </View>
          {adaptive.source === 'trend' && (
            <Text style={s.note}>
              Confidence: {adaptive.confidence}. Trending {ratePerWeek >= 0 ? '+' : ''}{ratePerWeek.toFixed(2)} kg/week.
            </Text>
          )}
        </View>

        {trendPts.length >= 2 && (
          <View style={s.card}>
            <Text style={s.label}>WEIGHT TREND (SMOOTHED)</Text>
            <TrendChart points={trendPts} color={accentColor} mc={mc} />
            <Text style={s.note}>
              Faint line = daily weigh-ins. Bold line = smoothed trend (filters water-weight noise) — this is what the expenditure estimate is based on, not raw daily numbers.
            </Text>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.label}>RECOMMENDED TARGETS</Text>
          <Text style={s.stat}>{targets.calories.toLocaleString()}</Text>
          <Text style={s.statSub}>kcal/day for your goal{cycleKcalAdjust ? ` (incl. +${cycleKcalAdjust} kcal ${cyclePhase} phase)` : ''}</Text>
          <View style={s.macroRow}>
            <View><Text style={s.macroV}>{targets.protein}g</Text><Text style={s.macroL}>PROTEIN</Text></View>
            <View><Text style={s.macroV}>{targets.carbs}g</Text><Text style={s.macroL}>CARBS</Text></View>
            <View><Text style={s.macroV}>{targets.fat}g</Text><Text style={s.macroL}>FAT</Text></View>
          </View>
        </View>

        {targetWeight && (
          <View style={s.card}>
            <Text style={s.label}>GOAL PROJECTION</Text>
            {goalDate ? (
              <>
                <Text style={s.stat}>{goalDate.weeksNeeded}</Text>
                <Text style={s.statSub}>weeks to reach {targetWeight}kg at current trend rate</Text>
                <Text style={s.note}>Projected date: {new Date(goalDate.date + 'T12:00').toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
              </>
            ) : (
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>
                {trendPts.length < 5
                  ? 'Log your weight a few more times to get a projection.'
                  : "Your current trend isn't moving toward your target weight yet."}
              </Text>
            )}
          </View>
        )}

        <Text style={[s.note, { marginTop: 4 }]}>
          This re-estimates your real expenditure weekly from how your smoothed weight trend actually moved versus what you logged eating — it gets more accurate the more consistently you log weight and food.
        </Text>
      </View>
    </ScrollView>
  );
}
