import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser, getToken } from '../auth';
import { API_BASE } from '../config';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS = ['Breakfast', 'Mid-morning snack', 'Lunch', 'Evening snack', 'Dinner'];

const GOALS = [
  { key: 'lose',     label: 'Lose weight',    mult: 0.8 },
  { key: 'maintain', label: 'Maintain',       mult: 1.0 },
  { key: 'gain',     label: 'Gain muscle',    mult: 1.15 },
];

const PREFS = [
  { key: 'non_veg',   label: 'Non-vegetarian' },
  { key: 'veg',       label: 'Vegetarian' },
  { key: 'vegan',     label: 'Vegan' },
  { key: 'eggetarian',label: 'Eggetarian' },
];

function parsePlan(text) {
  const plan = {};
  let currentDay = null;
  let currentMeal = null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const dayMatch = DAYS.find(d => line.toLowerCase().includes(d.toLowerCase()));
    if (dayMatch) { currentDay = dayMatch; plan[currentDay] = plan[currentDay] || {}; continue; }
    const mealMatch = MEALS.find(m => line.toLowerCase().includes(m.toLowerCase()));
    if (mealMatch && currentDay) { currentMeal = mealMatch; plan[currentDay][currentMeal] = plan[currentDay][currentMeal] || []; continue; }
    if (currentDay && currentMeal && line.startsWith('-') || line.startsWith('•') || line.match(/^\d/)) {
      plan[currentDay][currentMeal] = plan[currentDay][currentMeal] || [];
      plan[currentDay][currentMeal].push(line.replace(/^[-•\d.]\s*/, ''));
    }
  }
  return plan;
}

export default function MealPlanScreen() {
  const { mc, accentColor } = useTheme();
  const [goal,       setGoal]       = useState('maintain');
  const [pref,       setPref]       = useState('non_veg');
  const [calories,   setCalories]   = useState(null);     // from profile
  const [loading,    setLoading]    = useState(false);
  const [plan,       setPlan]       = useState(null);     // parsed plan object
  const [rawPlan,    setRawPlan]    = useState('');
  const [activeDay,  setActiveDay]  = useState('Monday');
  const [storageKey, setStorageKey] = useState(null);
  const [profile,    setProfile]    = useState({});

  useEffect(() => {
    async function load() {
      const u = await getUser();
      const key = `tg_mealplan_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.plan) setPlan(d.plan);
        if (d.rawPlan) setRawPlan(d.rawPlan);
        if (d.goal) setGoal(d.goal);
        if (d.pref) setPref(d.pref);
      }
      try {
        const token = await getToken();
        const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
        const res = await fetch(API_BASE + '/api/v1/me', { headers });
        const data = await res.json();
        setProfile(data);
        const w = parseFloat(data.weight_kg) || 70;
        const h = parseFloat(data.height_cm) || 170;
        const a = parseInt(data.age) || 25;
        const bmr = 10 * w + 6.25 * h - 5 * a + (data.gender === 'female' ? -161 : 5);
        const tdee = bmr * 1.55;
        const g = GOALS.find(g => g.key === goal) || GOALS[1];
        setCalories(Math.round(tdee * g.mult));
      } catch {}
    }
    load();
  }, []);

  async function generatePlan() {
    setLoading(true);
    const g = GOALS.find(x => x.key === goal)?.label || 'maintain weight';
    const p = PREFS.find(x => x.key === pref)?.label || 'non-vegetarian';
    const kcal = calories || 2000;
    const prompt = `Create a full 7-day ${p} meal plan for someone who wants to ${g}.
Target: ${kcal} calories per day.
Profile: ${profile.age ? `Age ${profile.age}` : ''} ${profile.gender || ''} ${profile.weight_kg ? `${profile.weight_kg}kg` : ''}.

For each day (Monday through Sunday), provide:
- Breakfast
- Mid-morning snack
- Lunch
- Evening snack
- Dinner

Each meal should include 2-4 specific foods with approximate portions. Include Indian foods where appropriate.
Format exactly like:
Monday
Breakfast
- Food item (portion)
Lunch
- Food item (portion)
etc.`;

    try {
      const token = await getToken();
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
      const res = await fetch(API_BASE + '/api/nutriai/chat', {
        method: 'POST', headers,
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      const text = data.response || data.message || data.content || '';
      const parsed = parsePlan(text);
      setPlan(Object.keys(parsed).length > 0 ? parsed : null);
      setRawPlan(text);
      if (storageKey) {
        await AsyncStorage.setItem(storageKey, JSON.stringify({ plan: parsed, rawPlan: text, goal, pref }));
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const st = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 20, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 24 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 8 },
    row:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
    chip:    { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    chipA:   { borderColor: accentColor, backgroundColor: accentColor + '18' },
    chipTxt: { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    chipTxA: { color: accentColor },
    genBtn:  { backgroundColor: accentColor, paddingVertical: 16, alignItems: 'center', marginBottom: 24 },
    genTxt:  { fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700', letterSpacing: 2 },
    dayTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
    dayTab:  { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: mc.border },
    dayTabA: { borderColor: accentColor, backgroundColor: accentColor + '18' },
    dayTxt:  { fontFamily: F.mono, fontSize: 10, color: mc.text3 },
    dayTxA:  { color: accentColor },
    mealCard:{ borderWidth: 1, borderColor: mc.border, padding: 14, marginBottom: 12 },
    mealLbl: { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 8 },
    mealItem:{ fontFamily: F.mono, fontSize: 12, color: mc.text, paddingVertical: 3 },
    rawTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text2, lineHeight: 18 },
  });

  const dayPlan = plan?.[activeDay] || {};

  return (
    <ScrollView style={st.root}>
      <View style={st.content}>
        <Text style={st.title}>Personalised Meal Plan</Text>
        <Text style={st.sub}>AI-GENERATED WEEKLY PLAN</Text>

        <Text style={st.label}>YOUR GOAL</Text>
        <View style={st.row}>
          {GOALS.map(g => (
            <TouchableOpacity key={g.key} style={[st.chip, goal === g.key && st.chipA]} onPress={() => setGoal(g.key)}>
              <Text style={[st.chipTxt, goal === g.key && st.chipTxA]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={st.label}>DIETARY PREFERENCE</Text>
        <View style={st.row}>
          {PREFS.map(p => (
            <TouchableOpacity key={p.key} style={[st.chip, pref === p.key && st.chipA]} onPress={() => setPref(p.key)}>
              <Text style={[st.chipTxt, pref === p.key && st.chipTxA]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {calories && (
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 16 }}>
            Estimated target: {calories} kcal/day based on your profile
          </Text>
        )}

        <TouchableOpacity style={st.genBtn} onPress={generatePlan} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#0A0A0A" />
            : <Text style={st.genTxt}>✦ GENERATE PLAN</Text>}
        </TouchableOpacity>

        {plan && Object.keys(plan).length > 0 ? (
          <>
            <View style={st.dayTabs}>
              {DAYS.map(d => (
                <TouchableOpacity key={d} style={[st.dayTab, activeDay === d && st.dayTabA]} onPress={() => setActiveDay(d)}>
                  <Text style={[st.dayTxt, activeDay === d && st.dayTxA]}>{d.slice(0, 3)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontFamily: F.serif, fontSize: 16, color: mc.text, marginBottom: 14 }}>{activeDay}</Text>
            {MEALS.map(meal => {
              const items = dayPlan[meal];
              if (!items?.length) return null;
              return (
                <View key={meal} style={st.mealCard}>
                  <Text style={st.mealLbl}>{meal.toUpperCase()}</Text>
                  {items.map((item, i) => <Text key={i} style={st.mealItem}>· {item}</Text>)}
                </View>
              );
            })}
            {Object.keys(dayPlan).length === 0 && rawPlan && (
              <Text style={st.rawTxt}>{rawPlan}</Text>
            )}
          </>
        ) : rawPlan ? (
          <View style={{ borderWidth: 1, borderColor: mc.border, padding: 16 }}>
            <Text style={st.rawTxt}>{rawPlan}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
