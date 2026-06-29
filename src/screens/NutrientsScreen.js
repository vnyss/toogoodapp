import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';

// Daily recommended values (adults)
const RDI = {
  calories:  { label: 'Calories',        unit: 'kcal', rdv: 2000 },
  protein:   { label: 'Protein',         unit: 'g',    rdv: 50   },
  carbs:     { label: 'Carbohydrates',   unit: 'g',    rdv: 275  },
  fat:       { label: 'Total Fat',       unit: 'g',    rdv: 78   },
  fiber:     { label: 'Dietary Fiber',   unit: 'g',    rdv: 28   },
  sugar:     { label: 'Total Sugars',    unit: 'g',    rdv: 50   },
  sodium:    { label: 'Sodium',          unit: 'mg',   rdv: 2300 },
  vitA:      { label: 'Vitamin A',       unit: 'μg',   rdv: 900  },
  vitC:      { label: 'Vitamin C',       unit: 'mg',   rdv: 90   },
  vitD:      { label: 'Vitamin D',       unit: 'μg',   rdv: 20   },
  vitB12:    { label: 'Vitamin B12',     unit: 'μg',   rdv: 2.4  },
  iron:      { label: 'Iron',            unit: 'mg',   rdv: 18   },
  calcium:   { label: 'Calcium',         unit: 'mg',   rdv: 1000 },
  potassium: { label: 'Potassium',       unit: 'mg',   rdv: 4700 },
  magnesium: { label: 'Magnesium',       unit: 'mg',   rdv: 420  },
  zinc:      { label: 'Zinc',            unit: 'mg',   rdv: 11   },
  omega3:    { label: 'Omega-3',         unit: 'g',    rdv: 1.6  },
};

const FOOD_NUTRIENTS = {
  'Egg (boiled)':        { fiber: 0, sugar: 0.6, sodium: 124, vitA: 87, vitC: 0, vitD: 2, vitB12: 0.9, iron: 1.2, calcium: 56, potassium: 147, magnesium: 12, zinc: 1.3, omega3: 0.04 },
  'Salmon (100g)':       { fiber: 0, sugar: 0, sodium: 59, vitA: 12, vitC: 0, vitD: 11, vitB12: 3.2, iron: 0.8, calcium: 12, potassium: 628, magnesium: 30, zinc: 0.6, omega3: 2.6 },
  'Spinach (100g)':      { fiber: 2.2, sugar: 0.4, sodium: 65, vitA: 469, vitC: 28, vitD: 0, vitB12: 0, iron: 2.7, calcium: 99, potassium: 558, magnesium: 79, zinc: 0.5, omega3: 0.1 },
  'Banana':              { fiber: 2.6, sugar: 12, sodium: 1, vitA: 4, vitC: 8.7, vitD: 0, vitB12: 0, iron: 0.3, calcium: 5, potassium: 358, magnesium: 27, zinc: 0.2, omega3: 0.03 },
  'Chicken breast (100g)':{ fiber: 0, sugar: 0, sodium: 74, vitA: 9, vitC: 0, vitD: 0.1, vitB12: 0.3, iron: 1, calcium: 15, potassium: 256, magnesium: 28, zinc: 1, omega3: 0.06 },
  'Milk (100ml)':        { fiber: 0, sugar: 5, sodium: 44, vitA: 46, vitC: 0, vitD: 1, vitB12: 0.4, iron: 0.1, calcium: 125, potassium: 150, magnesium: 11, zinc: 0.4, omega3: 0.07 },
  'Dal Tadka':           { fiber: 4, sugar: 1, sodium: 250, vitA: 5, vitC: 2, vitD: 0, vitB12: 0, iron: 2.5, calcium: 30, potassium: 280, magnesium: 40, zinc: 1.2, omega3: 0.05 },
  'Roti (wheat)':        { fiber: 1.5, sugar: 0.5, sodium: 120, vitA: 0, vitC: 0, vitD: 0, vitB12: 0, iron: 0.9, calcium: 10, potassium: 85, magnesium: 20, zinc: 0.4, omega3: 0.01 },
};

function NutrientBar({ value, rdv, color, unit }) {
  const pct = Math.min(100, Math.round((value / rdv) * 100));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1, height: 6, backgroundColor: '#2a2a2a', borderRadius: 3 }}>
        <View style={{ width: `${pct}%`, height: 6, backgroundColor: pct > 100 ? '#E57373' : color, borderRadius: 3 }} />
      </View>
      <Text style={{ fontFamily: F.mono, fontSize: 10, minWidth: 50, textAlign: 'right', color: '#888' }}>
        {value}{unit} ({pct}%)
      </Text>
    </View>
  );
}

export default function NutrientsScreen() {
  const { mc, accentColor } = useTheme();
  const [todayFoods,  setTodayFoods]  = useState([]);
  const [totals,      setTotals]      = useState({});
  const [activeTab,   setActiveTab]   = useState('macros');

  useEffect(() => {
    async function load() {
      const u = await getUser();
      const key = `toogood_daily_logs_${u}`;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return;
      const logs = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      const todayLog = logs.find(l => l.date === today);
      if (!todayLog) return;

      const foods = todayLog.foods || [];
      setTodayFoods(foods);

      const t = {};
      Object.keys(RDI).forEach(k => { t[k] = 0; });
      foods.forEach(f => {
        t.calories  += f.calories || 0;
        t.protein   += f.protein  || 0;
        t.carbs     += f.carbs    || 0;
        t.fat       += f.fat      || 0;
        t.fiber     += f.fiber    || 0;
        t.sugar     += f.sugar    || 0;
        t.sodium    += f.sodium   || 0;
        // Try known nutrients from our DB
        const known = FOOD_NUTRIENTS[f.name];
        if (known) {
          const scale = (f.serving?.match(/\d+/)?.[0] || 100) / 100;
          Object.keys(known).forEach(k => { t[k] = (t[k] || 0) + (known[k] || 0) * scale; });
        }
      });
      Object.keys(t).forEach(k => { t[k] = Math.round(t[k] * 10) / 10; });
      setTotals(t);
    }
    load();
  }, []);

  const MACRO_KEYS   = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];
  const VITAMIN_KEYS = ['vitA', 'vitC', 'vitD', 'vitB12'];
  const MINERAL_KEYS = ['iron', 'calcium', 'potassium', 'magnesium', 'zinc', 'omega3'];

  const tabs = [
    { key: 'macros',   label: 'Macros & Basics', keys: MACRO_KEYS },
    { key: 'vitamins', label: 'Vitamins',         keys: VITAMIN_KEYS },
    { key: 'minerals', label: 'Minerals',         keys: MINERAL_KEYS },
  ];

  const activeKeys = tabs.find(t => t.key === activeTab)?.keys || MACRO_KEYS;

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 20, maxWidth: 560, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 24 },
    tabs:    { flexDirection: 'row', gap: 8, marginBottom: 20 },
    tab:     { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    tabA:    { borderColor: accentColor, backgroundColor: accentColor + '18' },
    tabTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    tabTxA:  { color: accentColor },
    row:     { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
    rowTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    nutLbl:  { fontFamily: F.mono, fontSize: 12, color: mc.text },
    nutRdv:  { fontFamily: F.mono, fontSize: 10, color: mc.text3 },
    notice:  { borderWidth: 1, borderColor: mc.border, padding: 14, marginBottom: 20 },
    notTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3, lineHeight: 17 },
  });

  return (
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>Nutrient Tracker</Text>
        <Text style={s.sub}>TODAY'S DETAILED BREAKDOWN</Text>

        <View style={s.notice}>
          <Text style={s.notTxt}>
            ℹ️ Vitamins & minerals are estimated from our database for known Indian/common foods.{'\n'}
            For full accuracy, use barcode scan on packaged foods.
          </Text>
        </View>

        <View style={s.tabs}>
          {tabs.map(t => (
            <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabA]} onPress={() => setActiveTab(t.key)}>
              <Text style={[s.tabTxt, activeTab === t.key && s.tabTxA]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {todayFoods.length === 0 ? (
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3, textAlign: 'center', marginTop: 40 }}>
            No foods logged today.{'\n'}Go to Log Today to add your meals.
          </Text>
        ) : (
          activeKeys.map(k => {
            const { label, unit, rdv } = RDI[k];
            const val = totals[k] || 0;
            const pct = Math.min(100, Math.round((val / rdv) * 100));
            const color = pct < 30 ? '#E57373' : pct < 70 ? '#FFB74D' : pct <= 100 ? '#4CAF7C' : '#E57373';
            return (
              <View key={k} style={s.row}>
                <View style={s.rowTop}>
                  <Text style={s.nutLbl}>{label}</Text>
                  <Text style={[s.nutRdv, { color }]}>{pct}% of RDV</Text>
                </View>
                <NutrientBar value={val} rdv={rdv} color={color} unit={unit} />
                <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, marginTop: 3 }}>
                  Target: {rdv}{unit} daily
                </Text>
              </View>
            );
          })
        )}

        {todayFoods.length > 0 && (
          <View style={[s.notice, { marginTop: 20 }]}>
            <Text style={[s.notTxt, { color: mc.text2 }]}>Foods logged today: {todayFoods.map(f => f.name).join(', ')}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
