import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getToken } from '../auth';
import { API_BASE } from '../config';

const RISKS = [
  { key: 'diabetes',   label: 'Type 2 Diabetes',     icon: '🩸' },
  { key: 'hypertension', label: 'Hypertension',       icon: '💓' },
  { key: 'heart',      label: 'Cardiovascular',       icon: '❤️' },
  { key: 'obesity',    label: 'Obesity Risk',         icon: '⚖️' },
];

function RiskGauge({ score, color }) {
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (score / 10) * circ;
  return (
    <View style={{ width: 70, height: 70, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={70} height={70} style={{ position: 'absolute' }}>
        <Circle cx={35} cy={35} r={r} stroke="#333" strokeWidth={7} fill="none" />
        <Circle cx={35} cy={35} r={r} stroke={color} strokeWidth={7} fill="none"
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ * 0.25} strokeLinecap="round" />
      </Svg>
      <Text style={{ fontFamily: F.mono, fontSize: 16, fontWeight: '700', color }}>{score}</Text>
    </View>
  );
}

function riskColor(score) {
  if (score <= 3) return '#4CAF7C';
  if (score <= 6) return '#FFB74D';
  return '#E57373';
}

function riskLabel(score) {
  if (score <= 3) return 'Low';
  if (score <= 6) return 'Moderate';
  return 'High';
}

function calcRisks({ age, bmi, activityLevel, smoker, familyDiabetes, familyHeart, diet, stress, gender }) {
  const a = parseInt(age) || 30;
  const b = parseFloat(bmi) || 22;
  const act = activityLevel || 'moderate';
  const actScore = act === 'sedentary' ? 3 : act === 'light' ? 2 : act === 'moderate' ? 1 : 0;
  const dietScore = diet === 'poor' ? 3 : diet === 'average' ? 1 : 0;
  const stressScore = stress === 'high' ? 2 : stress === 'moderate' ? 1 : 0;
  const ageScore = a > 60 ? 3 : a > 45 ? 2 : a > 35 ? 1 : 0;

  const diabetes = Math.min(10, Math.round(
    (b > 30 ? 4 : b > 25 ? 2 : 0) +
    (familyDiabetes ? 2 : 0) +
    ageScore + actScore + (dietScore * 0.8)
  ));

  const hypertension = Math.min(10, Math.round(
    (smoker ? 2 : 0) + stressScore + actScore +
    (b > 30 ? 2 : b > 25 ? 1 : 0) + ageScore * 0.8
  ));

  const heart = Math.min(10, Math.round(
    (smoker ? 3 : 0) + (familyHeart ? 2 : 0) +
    ageScore + actScore * 0.8 + (dietScore * 0.7)
  ));

  const obesity = Math.min(10, Math.round(
    (b > 35 ? 8 : b > 30 ? 5 : b > 27 ? 3 : b > 25 ? 1 : 0) +
    actScore * 0.5 + dietScore * 0.5
  ));

  return { diabetes, hypertension, heart, obesity };
}

const RECS = {
  diabetes:     { low: 'Keep up your healthy habits.', moderate: 'Reduce refined carbs & sugar. Walk 30 min daily.', high: 'Consult a doctor. Monitor blood glucose regularly. Focus on low-GI foods.' },
  hypertension: { low: 'Great blood pressure habits.', moderate: 'Reduce sodium. Practice stress management. Sleep 7–8 hrs.', high: 'See a doctor. Cut salt, alcohol. Regular BP monitoring.' },
  heart:        { low: 'Heart health looks good.', moderate: 'Add omega-3 foods, reduce saturated fat. Regular cardio.', high: 'Consult a cardiologist. Quit smoking. Mediterranean diet.' },
  obesity:      { low: 'Healthy weight range.', moderate: 'Mind portion sizes. Increase protein. Move more.', high: 'Work with a dietitian. Focus on sustainable habits, not crash diets.' },
};

export default function HealthRiskScreen() {
  const { mc, accentColor } = useTheme();
  const [profile, setProfile] = useState({});
  const [smoker,        setSmoker]        = useState(false);
  const [familyDiabetes,setFamilyDiabetes]= useState(false);
  const [familyHeart,   setFamilyHeart]   = useState(false);
  const [diet,          setDiet]          = useState('average');
  const [stress,        setStress]        = useState('moderate');
  const [scores,        setScores]        = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
        const res = await fetch(API_BASE + '/api/v1/me', { headers });
        const d = await res.json();
        setProfile(d);
      } catch {}
    }
    load();
  }, []);

  function assess() {
    const wt = parseFloat(profile.weight_kg) || 70;
    const ht = parseFloat(profile.height_cm) || 170;
    const bmi = wt / ((ht / 100) ** 2);
    const result = calcRisks({
      age: profile.age,
      bmi,
      activityLevel: profile.activity_level,
      smoker, familyDiabetes, familyHeart,
      diet, stress,
      gender: profile.gender,
    });
    setScores(result);
  }

  const bmi = profile.weight_kg && profile.height_cm
    ? (parseFloat(profile.weight_kg) / ((parseFloat(profile.height_cm) / 100) ** 2)).toFixed(1)
    : null;

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 20, maxWidth: 560, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 24 },
    section: { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 12, marginTop: 8 },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 16 },
    row:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
    chip:    { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: mc.border },
    chipA:   { borderColor: accentColor, backgroundColor: accentColor + '18' },
    chipTxt: { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    chipTxA: { color: accentColor },
    toggle:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
    togLbl:  { fontFamily: F.mono, fontSize: 12, color: mc.text },
    togBtn:  { paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: mc.border },
    togBtnA: { borderColor: accentColor, backgroundColor: accentColor + '18' },
    togTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    togTxA:  { color: accentColor },
    assessBtn: { backgroundColor: accentColor, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    assessTxt: { fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700', letterSpacing: 2 },
    riskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: mc.border },
  });

  function Toggle({ label, value, onToggle }) {
    return (
      <View style={s.toggle}>
        <Text style={s.togLbl}>{label}</Text>
        <TouchableOpacity style={[s.togBtn, value && s.togBtnA]} onPress={onToggle}>
          <Text style={[s.togTxt, value && s.togTxA]}>{value ? 'Yes' : 'No'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>Health Risk Assessment</Text>
        <Text style={s.sub}>PERSONALISED RISK ANALYSIS</Text>

        {bmi && (
          <View style={[s.card, { flexDirection: 'row', gap: 20 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 1 }}>YOUR BMI</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 32, color: parseFloat(bmi) < 18.5 ? '#7C8BF5' : parseFloat(bmi) < 25 ? '#4CAF7C' : parseFloat(bmi) < 30 ? '#FFB74D' : '#E57373', fontWeight: '700' }}>{bmi}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>
                {parseFloat(bmi) < 18.5 ? 'Underweight' : parseFloat(bmi) < 25 ? 'Normal weight' : parseFloat(bmi) < 30 ? 'Overweight' : 'Obese'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 1 }}>PROFILE</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2, marginTop: 4 }}>{profile.age ? `Age: ${profile.age}` : 'Age: not set'}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2 }}>{profile.gender ? `Gender: ${profile.gender}` : 'Gender: not set'}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2 }}>{profile.weight_kg ? `${profile.weight_kg} kg` : 'Weight: not set'}</Text>
            </View>
          </View>
        )}

        <Text style={s.section}>LIFESTYLE QUESTIONS</Text>

        <View style={s.card}>
          <Toggle label="Do you smoke?" value={smoker} onToggle={() => setSmoker(v => !v)} />
          <Toggle label="Family history of diabetes?" value={familyDiabetes} onToggle={() => setFamilyDiabetes(v => !v)} />
          <Toggle label="Family history of heart disease?" value={familyHeart} onToggle={() => setFamilyHeart(v => !v)} />
        </View>

        <View style={s.card}>
          <Text style={s.section}>DIET QUALITY</Text>
          <View style={s.row}>
            {['poor', 'average', 'good'].map(d => (
              <TouchableOpacity key={d} style={[s.chip, diet === d && s.chipA]} onPress={() => setDiet(d)}>
                <Text style={[s.chipTxt, diet === d && s.chipTxA]}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.section, { marginTop: 12 }]}>STRESS LEVEL</Text>
          <View style={s.row}>
            {['low', 'moderate', 'high'].map(d => (
              <TouchableOpacity key={d} style={[s.chip, stress === d && s.chipA]} onPress={() => setStress(d)}>
                <Text style={[s.chipTxt, stress === d && s.chipTxA]}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={s.assessBtn} onPress={assess}>
          <Text style={s.assessTxt}>ASSESS MY RISK</Text>
        </TouchableOpacity>

        {scores && (
          <View style={[s.card, { marginTop: 20 }]}>
            <Text style={[s.section, { marginTop: 0 }]}>YOUR RISK SCORES (out of 10)</Text>
            {RISKS.map(r => {
              const sc = scores[r.key];
              const col = riskColor(sc);
              const lbl = riskLabel(sc);
              const rec = RECS[r.key][lbl.toLowerCase()];
              return (
                <View key={r.key} style={s.riskRow}>
                  <RiskGauge score={sc} color={col} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text }}>{r.icon} {r.label}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: col, marginTop: 2 }}>{lbl} risk</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 4 }}>{rec}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
