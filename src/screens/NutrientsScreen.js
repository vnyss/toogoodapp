import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';

const RDI = {
  calories:  { label: 'Calories',      unit: 'kcal', rdv: 2000, group: 'macro'   },
  protein:   { label: 'Protein',       unit: 'g',    rdv: 50,   group: 'macro'   },
  carbs:     { label: 'Carbs',         unit: 'g',    rdv: 275,  group: 'macro'   },
  fat:       { label: 'Total Fat',     unit: 'g',    rdv: 78,   group: 'macro'   },
  fiber:     { label: 'Fiber',         unit: 'g',    rdv: 28,   group: 'macro'   },
  sugar:     { label: 'Sugars',        unit: 'g',    rdv: 50,   group: 'macro'   },
  sodium:    { label: 'Sodium',        unit: 'mg',   rdv: 2300, group: 'macro'   },
  alcohol:   { label: 'Alcohol',       unit: 'g',    rdv: 14,   group: 'macro'   },
  vitA:      { label: 'Vitamin A',     unit: 'μg',   rdv: 900,  group: 'vitamin' },
  vitC:      { label: 'Vitamin C',     unit: 'mg',   rdv: 90,   group: 'vitamin' },
  vitD:      { label: 'Vitamin D',     unit: 'μg',   rdv: 20,   group: 'vitamin' },
  vitB12:    { label: 'Vitamin B12',   unit: 'μg',   rdv: 2.4,  group: 'vitamin' },
  iron:      { label: 'Iron',          unit: 'mg',   rdv: 18,   group: 'mineral' },
  calcium:   { label: 'Calcium',       unit: 'mg',   rdv: 1000, group: 'mineral' },
  potassium: { label: 'Potassium',     unit: 'mg',   rdv: 4700, group: 'mineral' },
  magnesium: { label: 'Magnesium',     unit: 'mg',   rdv: 420,  group: 'mineral' },
  zinc:      { label: 'Zinc',          unit: 'mg',   rdv: 11,   group: 'mineral' },
  omega3:    { label: 'Omega-3',       unit: 'g',    rdv: 1.6,  group: 'mineral' },
};

// Food → nutrient data for estimation
const FOOD_NUTRIENTS = {
  'Egg (boiled)':          { fiber:0, sugar:0.6, sodium:124, vitA:87,  vitC:0,   vitD:2,  vitB12:0.9, iron:1.2, calcium:56,  potassium:147, magnesium:12, zinc:1.3, omega3:0.04 },
  'Salmon (100g)':         { fiber:0, sugar:0,   sodium:59,  vitA:12,  vitC:0,   vitD:11, vitB12:3.2, iron:0.8, calcium:12,  potassium:628, magnesium:30, zinc:0.6, omega3:2.6  },
  'Spinach (100g)':        { fiber:2.2,sugar:0.4,sodium:65,  vitA:469, vitC:28,  vitD:0,  vitB12:0,   iron:2.7, calcium:99,  potassium:558, magnesium:79, zinc:0.5, omega3:0.1  },
  'Banana':                { fiber:2.6,sugar:12, sodium:1,   vitA:4,   vitC:8.7, vitD:0,  vitB12:0,   iron:0.3, calcium:5,   potassium:358, magnesium:27, zinc:0.2, omega3:0.03 },
  'Chicken breast (100g)': { fiber:0, sugar:0,   sodium:74,  vitA:9,   vitC:0,   vitD:0.1,vitB12:0.3, iron:1,   calcium:15,  potassium:256, magnesium:28, zinc:1,   omega3:0.06 },
  'Milk (100ml)':          { fiber:0, sugar:5,   sodium:44,  vitA:46,  vitC:0,   vitD:1,  vitB12:0.4, iron:0.1, calcium:125, potassium:150, magnesium:11, zinc:0.4, omega3:0.07 },
  'Dal Tadka':             { fiber:4, sugar:1,   sodium:250, vitA:5,   vitC:2,   vitD:0,  vitB12:0,   iron:2.5, calcium:30,  potassium:280, magnesium:40, zinc:1.2, omega3:0.05 },
  'Roti (wheat)':          { fiber:1.5,sugar:0.5,sodium:120, vitA:0,   vitC:0,   vitD:0,  vitB12:0,   iron:0.9, calcium:10,  potassium:85,  magnesium:20, zinc:0.4, omega3:0.01 },
  'Paneer (100g)':         { fiber:0, sugar:2,   sodium:30,  vitA:160, vitC:0,   vitD:0.2,vitB12:0.6, iron:0.5, calcium:480, potassium:90,  magnesium:20, zinc:0.8, omega3:0.1  },
  'Oats (100g)':           { fiber:10,sugar:1,   sodium:6,   vitA:0,   vitC:0,   vitD:0,  vitB12:0,   iron:4.7, calcium:54,  potassium:429, magnesium:177,zinc:4,   omega3:0.11 },
};

// Food sources for deficient nutrients
const FOOD_SOURCES = {
  vitD:      ['Salmon, tuna, mackerel', 'Egg yolks', 'Fortified milk / orange juice', 'Mushrooms (sun-exposed)', 'Sardines'],
  vitB12:    ['Meat, fish, poultry', 'Dairy products', 'Eggs', 'Fortified cereals', 'Nutritional yeast (vegan)'],
  iron:      ['Red meat, liver', 'Spinach, lentils', 'Tofu, tempeh', 'Pumpkin seeds', 'Dark chocolate'],
  calcium:   ['Dairy (milk, cheese, yogurt)', 'Leafy greens (kale, bok choy)', 'Fortified plant milks', 'Sardines with bones', 'Almonds'],
  magnesium: ['Nuts and seeds (pumpkin, chia)', 'Leafy greens', 'Dark chocolate', 'Avocado', 'Legumes'],
  omega3:    ['Fatty fish (salmon, mackerel)', 'Walnuts', 'Flaxseeds, chia seeds', 'Hemp seeds', 'Algae oil (vegan)'],
  potassium: ['Bananas, avocado', 'Sweet potato', 'Leafy greens', 'Beans and lentils', 'Beet greens'],
  vitA:      ['Liver', 'Carrots, sweet potato', 'Spinach, kale', 'Red/yellow peppers', 'Eggs'],
  vitC:      ['Citrus fruits', 'Bell peppers', 'Broccoli, Brussels sprouts', 'Strawberries', 'Kiwi'],
  zinc:      ['Oysters, shellfish', 'Red meat', 'Pumpkin seeds', 'Chickpeas, lentils', 'Nuts'],
  fiber:     ['Whole grains (oats, brown rice)', 'Legumes (lentils, beans)', 'Berries', 'Vegetables', 'Nuts and seeds'],
  protein:   ['Chicken, turkey, fish', 'Eggs and dairy', 'Legumes and tofu', 'Greek yogurt', 'Quinoa'],
};

// Macro pie chart
function MacroPie({ protein, carbs, fat, size = 160 }) {
  const total = protein * 4 + carbs * 4 + fat * 9;
  if (!total) return null;
  const pPct = (protein * 4) / total;
  const cPct = (carbs * 4) / total;
  const fPct = (fat * 9) / total;
  const C = size / 2, R = C - 14;
  const circ = 2 * Math.PI * R;

  function arc(startPct, endPct, color) {
    const s = startPct * circ, e = (endPct - startPct) * circ;
    return <Circle key={color} cx={C} cy={C} r={R} fill="none" stroke={color} strokeWidth={28}
      strokeDasharray={`${e} ${circ - e}`} strokeDashoffset={circ * 0.25 - s} />;
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arc(0,          pPct,        '#7C8BF5')}
      {arc(pPct,       pPct+cPct,   '#FFB74D')}
      {arc(pPct+cPct,  1,           '#E57373')}
      <SvgText x={C} y={C-6} textAnchor="middle" fontSize={9} fill="#888">CALORIES</SvgText>
      <SvgText x={C} y={C+10} textAnchor="middle" fontSize={18} fontWeight="700" fill="#ddd">{Math.round(total)}</SvgText>
    </Svg>
  );
}

function NutrientRow({ label, value, rdv, unit, color, foods }) {
  const { mc } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const pct = Math.min(130, Math.round((value / rdv) * 100));
  const barColor = pct < 30 ? '#E57373' : pct < 70 ? '#FFB74D' : pct <= 100 ? '#4CAF7C' : '#E57373';
  return (
    <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.7}
      style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{label}</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 10, color: barColor }}>{value}{unit} · {pct}%</Text>
      </View>
      <View style={{ height: 6, backgroundColor: '#2a2a2a', borderRadius: 3 }}>
        <View style={{ width: `${Math.min(100, pct)}%`, height: 6, backgroundColor: barColor, borderRadius: 3 }} />
      </View>
      <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, marginTop: 3 }}>RDV: {rdv}{unit}</Text>
      {expanded && pct < 70 && foods && (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: mc.border }}>
          <Text style={{ fontFamily: F.mono, fontSize: 9, color: barColor, letterSpacing: 1, marginBottom: 6 }}>TOP FOOD SOURCES</Text>
          {foods.map((f, i) => (
            <Text key={i} style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 3 }}>• {f}</Text>
          ))}
        </View>
      )}
      {expanded && pct > 100 && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, color: '#E57373' }}>⚠️ Over daily recommended value. Consider reducing intake.</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Per-food micronutrients: prefer real data captured on the food entry itself
// (barcode scans / food search now carry this from Open Food Facts), and only
// fall back to the small hardcoded lookup table by exact name match.
const MICRO_KEYS = ['fiber', 'sugar', 'sodium', 'alcohol', 'vitA', 'vitC', 'vitD', 'vitB12', 'iron', 'calcium', 'potassium', 'magnesium', 'zinc', 'omega3'];
function microsForFood(f) {
  const known = FOOD_NUTRIENTS[f.name];
  const scale = (f.serving?.match(/\d+/)?.[0] || 100) / 100;
  const out = {};
  MICRO_KEYS.forEach(k => {
    if (f[k] != null && f[k] !== '') out[k] = parseFloat(f[k]) || 0;
    else if (known && known[k] != null) out[k] = known[k] * scale;
  });
  return out;
}

function totalsForFoods(foods) {
  const t = {}; Object.keys(RDI).forEach(k => { t[k] = 0; });
  foods.forEach(f => {
    t.calories += f.calories || 0;
    t.protein  += f.protein  || 0;
    t.carbs    += f.carbs    || 0;
    t.fat      += f.fat      || 0;
    const micros = microsForFood(f);
    Object.entries(micros).forEach(([k, v]) => { t[k] += v; });
  });
  Object.keys(t).forEach(k => { t[k] = Math.round(t[k] * 10) / 10; });
  return t;
}

function scoreForTotals(t) {
  const trackable = Object.keys(RDI).filter(k => !['calories', 'sugar', 'sodium', 'alcohol'].includes(k));
  const hits = trackable.filter(k => (t[k] || 0) / RDI[k].rdv >= 0.7).length;
  return Math.round((hits / trackable.length) * 100);
}

export default function NutrientsScreen() {
  const { mc, accentColor } = useTheme();
  const [todayFoods, setTodayFoods] = useState([]);
  const [totals,     setTotals]     = useState({});
  const [tab,        setTab]        = useState('overview');
  const [weekScore,  setWeekScore]  = useState(null);

  useEffect(() => {
    (async () => {
      const u = await getUser();
      const raw = await AsyncStorage.getItem(`toogood_daily_logs_${u}`);
      if (!raw) return;
      const logs = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      const todayLog = logs.find(l => l.date === today);
      const foods = todayLog?.foods || [];
      setTodayFoods(foods);
      setTotals(totalsForFoods(foods));

      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6);
      const cutoffISO = cutoff.toISOString().slice(0, 10);
      const recentDays = logs.filter(l => l.date >= cutoffISO && l.date <= today && (l.foods || []).length > 0);
      if (recentDays.length > 0) {
        const avg = recentDays.reduce((s, l) => s + scoreForTotals(totalsForFoods(l.foods)), 0) / recentDays.length;
        setWeekScore({ avg: Math.round(avg), days: recentDays.length });
      } else {
        setWeekScore(null);
      }
    })();
  }, []);

  const MACRO_KEYS   = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'alcohol'];
  const VITAMIN_KEYS = ['vitA', 'vitC', 'vitD', 'vitB12'];
  const MINERAL_KEYS = ['iron', 'calcium', 'potassium', 'magnesium', 'zinc', 'omega3'];

  // Deficiency alerts
  const DEFICIENCY_TRACKED = ['protein', 'fiber', 'vitA', 'vitC', 'vitD', 'vitB12', 'iron', 'calcium', 'potassium', 'magnesium', 'zinc', 'omega3'];
  const deficient = Object.entries(RDI)
    .filter(([k]) => DEFICIENCY_TRACKED.includes(k))
    .filter(([k]) => (totals[k] || 0) / RDI[k].rdv < 0.3)
    .map(([k]) => ({ key: k, ...RDI[k] }));

  const excess = Object.entries(RDI)
    .filter(([k]) => ['sugar', 'sodium', 'alcohol'].includes(k))
    .filter(([k]) => (totals[k] || 0) > RDI[k].rdv)
    .map(([k]) => ({ key: k, ...RDI[k] }));

  // Score
  const score = scoreForTotals(totals);

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 20, maxWidth: 620, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 16 },
    tabs:    { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
    tab:     { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    tabA:    { borderColor: accentColor, backgroundColor: accentColor + '18' },
    tabTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    tabTxA:  { color: accentColor },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 10 },
  });

  const TABS = [
    { k: 'overview', l: 'Overview' },
    { k: 'macros',   l: 'Macros' },
    { k: 'vitamins', l: 'Vitamins' },
    { k: 'minerals', l: 'Minerals' },
    { k: 'foods',    l: 'By Food' },
  ];

  if (todayFoods.length === 0) return (
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>Nutrient Tracker</Text>
        <Text style={s.sub}>TODAY'S DETAILED BREAKDOWN</Text>
        <View style={s.card}>
          <Text style={{ fontFamily: F.mono, fontSize: 14, color: mc.text, marginBottom: 8 }}>No foods logged today</Text>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, lineHeight: 18 }}>
            Go to Log Today → add your meals → come back here to see your full nutrient breakdown.
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>Nutrient Tracker</Text>
        <Text style={s.sub}>TODAY'S DETAILED BREAKDOWN</Text>

        <View style={s.tabs}>
          {TABS.map(t => (
            <TouchableOpacity key={t.k} style={[s.tab, tab === t.k && s.tabA]} onPress={() => setTab(t.k)}>
              <Text style={[s.tabTxt, tab === t.k && s.tabTxA]}>{t.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            {/* Score + Pie */}
            <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 20 }]}>
              <MacroPie protein={totals.protein || 0} carbs={totals.carbs || 0} fat={totals.fat || 0} />
              <View style={{ flex: 1 }}>
                <Text style={s.label}>NUTRITION SCORE</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 48, fontWeight: '700', color: score >= 70 ? '#4CAF7C' : score >= 40 ? '#FFB74D' : '#E57373' }}>{score}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 1 }}>/ 100 TODAY</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                  {[['#7C8BF5', 'P', totals.protein || 0, 'g'], ['#FFB74D', 'C', totals.carbs || 0, 'g'], ['#E57373', 'F', totals.fat || 0, 'g']].map(([col, lbl, val, unit]) => (
                    <View key={lbl}>
                      <View style={{ width: 10, height: 10, backgroundColor: col, borderRadius: 2, marginBottom: 2 }} />
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text }}>{val}{unit}</Text>
                      <Text style={{ fontFamily: F.mono, fontSize: 8, color: mc.text3 }}>{lbl}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {weekScore && (
              <View style={s.card}>
                <Text style={s.label}>7-DAY AVERAGE DIET QUALITY</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 28, fontWeight: '700', color: weekScore.avg >= 70 ? '#4CAF7C' : weekScore.avg >= 40 ? '#FFB74D' : '#E57373' }}>{weekScore.avg}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>/ 100 · across {weekScore.days} logged day{weekScore.days === 1 ? '' : 's'}</Text>
                </View>
              </View>
            )}

            {/* Alerts */}
            {deficient.length > 0 && (
              <View style={[s.card, { borderColor: '#E57373' + '44' }]}>
                <Text style={[s.label, { color: '#E57373' }]}>⚠️ LOW NUTRIENTS TODAY</Text>
                {deficient.map(d => (
                  <View key={d.key} style={{ marginBottom: 12 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#E57373', marginBottom: 3 }}>
                      {d.label} — only {totals[d.key] || 0}{d.unit} ({Math.round((totals[d.key] || 0) / d.rdv * 100)}% of RDV)
                    </Text>
                    {FOOD_SOURCES[d.key] && (
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>
                        Eat more: {FOOD_SOURCES[d.key].slice(0, 2).join(', ')}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {excess.length > 0 && (
              <View style={[s.card, { borderColor: '#FFB74D' + '44' }]}>
                <Text style={[s.label, { color: '#FFB74D' }]}>⚠️ OVER LIMIT</Text>
                {excess.map(d => (
                  <Text key={d.key} style={{ fontFamily: F.mono, fontSize: 12, color: '#FFB74D', marginBottom: 4 }}>
                    {d.label}: {totals[d.key] || 0}{d.unit} (limit {d.rdv}{d.unit})
                  </Text>
                ))}
              </View>
            )}

            {/* Quick macro stats */}
            <View style={s.card}>
              <Text style={s.label}>CALORIE BREAKDOWN</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                {[
                  { label: 'CALORIES', val: `${totals.calories || 0}`, unit: 'kcal', col: accentColor },
                  { label: 'PROTEIN',  val: `${totals.protein  || 0}`, unit: 'g',    col: '#7C8BF5' },
                  { label: 'CARBS',    val: `${totals.carbs    || 0}`, unit: 'g',    col: '#FFB74D' },
                  { label: 'FAT',      val: `${totals.fat      || 0}`, unit: 'g',    col: '#E57373' },
                ].map(m => (
                  <View key={m.label} style={{ alignItems: 'center' }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 20, fontWeight: '700', color: m.col }}>{m.val}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 8, color: mc.text3, letterSpacing: 1 }}>{m.unit}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 8, color: mc.text3, marginTop: 2 }}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── MACROS / VITAMINS / MINERALS ── */}
        {['macros', 'vitamins', 'minerals'].includes(tab) && (
          <View style={s.card}>
            <Text style={s.label}>
              {tab === 'macros' ? 'MACROS & BASICS' : tab === 'vitamins' ? 'VITAMINS' : 'MINERALS & ESSENTIALS'}
              {' '}— tap a row to expand
            </Text>
            {(tab === 'macros' ? MACRO_KEYS : tab === 'vitamins' ? VITAMIN_KEYS : MINERAL_KEYS).map(k => {
              const { label, unit, rdv } = RDI[k];
              const val = totals[k] || 0;
              const pct = Math.min(130, Math.round((val / rdv) * 100));
              const color = pct < 30 ? '#E57373' : pct < 70 ? '#FFB74D' : pct <= 100 ? '#4CAF7C' : '#E57373';
              return <NutrientRow key={k} label={label} value={val} rdv={rdv} unit={unit} color={color} foods={FOOD_SOURCES[k]} />;
            })}
          </View>
        )}

        {/* ── BY FOOD ── */}
        {tab === 'foods' && (
          <>
            <View style={[s.card, { marginBottom: 8 }]}>
              <Text style={s.label}>TODAY'S FOODS ({todayFoods.length})</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>ℹ️ Micronutrient data comes from barcode/search lookups or known foods — manually typed entries may not have it.</Text>
            </View>
            {todayFoods.map((f, i) => {
              const known = microsForFood(f);
              return (
                <View key={i} style={s.card}>
                  <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text, marginBottom: 4 }}>{f.name}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 10 }}>
                    {f.serving || '100g'} · {f.calories || 0} kcal
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {[
                      { l: 'Protein', v: f.protein || 0, u: 'g', c: '#7C8BF5' },
                      { l: 'Carbs',   v: f.carbs   || 0, u: 'g', c: '#FFB74D' },
                      { l: 'Fat',     v: f.fat     || 0, u: 'g', c: '#E57373' },
                      { l: 'Fiber',   v: f.fiber   || 0, u: 'g', c: '#4CAF7C' },
                    ].map(m => (
                      <View key={m.l} style={{ alignItems: 'center', minWidth: 56 }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 14, fontWeight: '700', color: m.c }}>{m.v}</Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 8, color: mc.text3 }}>{m.u} {m.l}</Text>
                      </View>
                    ))}
                  </View>
                  {Object.values(known).some(v => v > 0) && (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: mc.border }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, marginBottom: 6, letterSpacing: 1 }}>MICRONUTRIENTS</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {Object.entries(known).filter(([, v]) => v > 0).map(([k, v]) => {
                          const nutrient = Object.entries(RDI).find(([rk]) => rk === k)?.[1];
                          return (
                            <View key={k} style={{ alignItems: 'center', minWidth: 64 }}>
                              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text }}>{Math.round(v * 10) / 10}</Text>
                              <Text style={{ fontFamily: F.mono, fontSize: 8, color: mc.text3 }}>{nutrient?.unit || ''} {nutrient?.label || k}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </View>
    </ScrollView>
  );
}
