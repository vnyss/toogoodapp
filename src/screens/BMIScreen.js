import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getToken } from '../auth';
import { API_BASE } from '../config';

const BMI_ZONES = [
  { label: 'Underweight', min: 0,    max: 18.5, color: '#7C8BF5' },
  { label: 'Normal',      min: 18.5, max: 25,   color: '#4CAF7C' },
  { label: 'Overweight',  min: 25,   max: 30,   color: '#FFB74D' },
  { label: 'Obese',       min: 30,   max: 99,   color: '#E57373' },
];

function getBMIZone(bmi) {
  return BMI_ZONES.find(z => bmi >= z.min && bmi < z.max) || BMI_ZONES[BMI_ZONES.length - 1];
}

function BMIGauge({ bmi, color }) {
  const SIZE = 220, R = 84;
  const cx = SIZE / 2, cy = SIZE / 2 + 20;
  const clampedBMI = Math.min(Math.max(bmi, 15), 40);
  const pct = (clampedBMI - 15) / 25;
  const angle = -180 + pct * 180;
  const rad = (angle * Math.PI) / 180;
  const nx = cx + R * Math.cos(rad);
  const ny = cy + R * Math.sin(rad);
  return (
    <View style={{ alignItems: 'center', marginBottom: 4 }}>
      <Svg width={SIZE} height={SIZE / 2 + 44}>
        {BMI_ZONES.map((z, i) => {
          const startPct = (Math.max(z.min, 15) - 15) / 25;
          const endPct   = (Math.min(z.max, 40) - 15) / 25;
          const sa = (-180 + startPct * 180) * Math.PI / 180;
          const ea = (-180 + endPct   * 180) * Math.PI / 180;
          const x1 = cx + R * Math.cos(sa), y1 = cy + R * Math.sin(sa);
          const x2 = cx + R * Math.cos(ea), y2 = cy + R * Math.sin(ea);
          const largeArc = (endPct - startPct) > 0.5 ? 1 : 0;
          return <Path key={i} d={`M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`} stroke={z.color} strokeWidth={18} fill="none" strokeLinecap="round" />;
        })}
        <Line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={cx} cy={cy} r={7} fill={color} />
      </Svg>
      <Text style={{ fontFamily: F.mono, fontSize: 52, fontWeight: '700', color, marginTop: -24 }}>{bmi.toFixed(1)}</Text>
    </View>
  );
}

function calcBodyFat(bmi, age, gender) {
  const a = parseFloat(age) || 25;
  const isMale = (gender || '').toLowerCase() !== 'female';
  return Math.round((1.2 * bmi + 0.23 * a - 10.8 * (isMale ? 1 : 0) - 5.4) * 10) / 10;
}

function idealWeightRange(heightCm) {
  const hM = parseFloat(heightCm) / 100;
  return { min: Math.round(18.5 * hM * hM), max: Math.round(24.9 * hM * hM) };
}

const ZONE_TIPS = {
  Underweight: 'Focus on nutrient-dense, calorie-rich foods like nuts, avocados, whole grains and lean protein. Consider speaking to a dietitian.',
  Normal:      'Your BMI is in the healthy range. Keep it up with balanced nutrition and regular movement.',
  Overweight:  'A modest calorie reduction (250–500 kcal/day) and 150+ min of moderate exercise per week can help you reach the Normal range.',
  Obese:       'This BMI level increases risk of heart disease, diabetes and joint problems. A structured diet + exercise plan with professional support is recommended.',
};

export default function BMIScreen() {
  const { mc, accentColor } = useTheme();

  // profile data (auto-loaded)
  const [profileWeight, setProfileWeight] = useState('');
  const [profileHeight, setProfileHeight] = useState('');
  const [profileAge,    setProfileAge]    = useState('');
  const [profileGender, setProfileGender] = useState('male');
  const [profileName,   setProfileName]   = useState('');
  const [loading,       setLoading]       = useState(true);

  // custom mode (calculate for another person)
  const [mode,          setMode]          = useState('profile'); // 'profile' | 'custom'
  const [custWeight,    setCustWeight]    = useState('');
  const [custHeight,    setCustHeight]    = useState('');
  const [custAge,       setCustAge]       = useState('');
  const [custGender,    setCustGender]    = useState('male');

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
        const res = await fetch(API_BASE + '/api/v1/me', { headers });
        const d = await res.json();
        // handle various field name conventions
        const w = d.weight_kg || d.weight || d.current_weight || '';
        const h = d.height_cm || d.height || d.height_m ? (d.height_m ? d.height_m * 100 : '') : '';
        const finalH = d.height_cm || d.height || (d.height_m ? d.height_m * 100 : '');
        if (w)          setProfileWeight(String(w));
        if (finalH)     setProfileHeight(String(finalH));
        if (d.age)      setProfileAge(String(d.age));
        if (d.gender)   setProfileGender(d.gender.toLowerCase());
        if (d.name || d.full_name) setProfileName(d.name || d.full_name);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const activeW = mode === 'profile' ? profileWeight : custWeight;
  const activeH = mode === 'profile' ? profileHeight : custHeight;
  const activeA = mode === 'profile' ? profileAge    : custAge;
  const activeG = mode === 'profile' ? profileGender : custGender;

  const w   = parseFloat(activeW);
  const h   = parseFloat(activeH);
  const bmi = (w && h) ? Math.round((w / ((h / 100) ** 2)) * 10) / 10 : null;
  const zone = bmi ? getBMIZone(bmi) : null;
  const bodyFat = bmi ? calcBodyFat(bmi, activeA, activeG) : null;
  const ideal   = h ? idealWeightRange(h) : null;
  const diff    = (bmi && ideal) ? (bmi > 24.9 ? -(w - ideal.max) : bmi < 18.5 ? ideal.min - w : 0) : null;

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 20, maxWidth: 560, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 8 },
    row:     { flexDirection: 'row', gap: 12, marginBottom: 12 },
    field:   { flex: 1 },
    flabel:  { fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 4 },
    input:   { borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, fontSize: 14, color: mc.text },
    metRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 12 },
    met:     { alignItems: 'center', minWidth: 80 },
    metVal:  { fontFamily: F.mono, fontSize: 22, fontWeight: '700' },
    metLbl:  { fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 1, marginTop: 2 },
    genRow:  { flexDirection: 'row', gap: 8 },
    genBtn:  { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    genBtnA: { borderColor: accentColor, backgroundColor: accentColor + '18' },
    genTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    genTxA:  { color: accentColor },
    modeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    modeBtn: { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: mc.border, alignItems: 'center' },
    modeBtnA:{ borderColor: accentColor, backgroundColor: accentColor + '18' },
    modeTxt: { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    modeTxA: { color: accentColor },
  });

  if (loading) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>BMI & Body Metrics</Text>
        <Text style={s.sub}>BODY MASS INDEX</Text>

        {/* Mode toggle */}
        <View style={s.modeRow}>
          <TouchableOpacity style={[s.modeBtn, mode === 'profile' && s.modeBtnA]} onPress={() => setMode('profile')}>
            <Text style={[s.modeTxt, mode === 'profile' && s.modeTxA]}>
              {profileName ? `My Profile (${profileName.split(' ')[0]})` : 'My Profile'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.modeBtn, mode === 'custom' && s.modeBtnA]} onPress={() => setMode('custom')}>
            <Text style={[s.modeTxt, mode === 'custom' && s.modeTxA]}>Someone Else</Text>
          </TouchableOpacity>
        </View>

        {/* Profile mode — shows read-only summary, no form needed */}
        {mode === 'profile' && (
          <View style={[s.card, { marginBottom: 14 }]}>
            <Text style={s.label}>FROM YOUR PROFILE</Text>
            <View style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'Weight', value: profileWeight ? `${profileWeight} kg` : '—' },
                { label: 'Height', value: profileHeight ? `${profileHeight} cm` : '—' },
                { label: 'Age',    value: profileAge    || '—' },
                { label: 'Gender', value: profileGender ? profileGender.charAt(0).toUpperCase() + profileGender.slice(1) : '—' },
              ].map(f => (
                <View key={f.label}>
                  <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, marginBottom: 2 }}>{f.label.toUpperCase()}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 14, color: mc.text }}>{f.value}</Text>
                </View>
              ))}
            </View>
            {(!profileWeight || !profileHeight) && (
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#FFB74D', marginTop: 10 }}>
                ⚠️ Height or weight missing from your profile. Go to Settings → Profile to update.
              </Text>
            )}
          </View>
        )}

        {/* Custom mode — editable form */}
        {mode === 'custom' && (
          <View style={s.card}>
            <Text style={s.label}>ENTER DETAILS</Text>
            <View style={s.row}>
              <View style={s.field}>
                <Text style={s.flabel}>WEIGHT (KG)</Text>
                <TextInput style={s.input} value={custWeight} onChangeText={setCustWeight} keyboardType="decimal-pad" placeholder="70" placeholderTextColor={mc.text3} />
              </View>
              <View style={s.field}>
                <Text style={s.flabel}>HEIGHT (CM)</Text>
                <TextInput style={s.input} value={custHeight} onChangeText={setCustHeight} keyboardType="decimal-pad" placeholder="170" placeholderTextColor={mc.text3} />
              </View>
            </View>
            <View style={s.row}>
              <View style={s.field}>
                <Text style={s.flabel}>AGE</Text>
                <TextInput style={s.input} value={custAge} onChangeText={setCustAge} keyboardType="number-pad" placeholder="28" placeholderTextColor={mc.text3} />
              </View>
              <View style={[s.field, { justifyContent: 'flex-end' }]}>
                <Text style={s.flabel}>GENDER</Text>
                <View style={s.genRow}>
                  {['male', 'female'].map(g => (
                    <TouchableOpacity key={g} style={[s.genBtn, custGender === g && s.genBtnA]} onPress={() => setCustGender(g)}>
                      <Text style={[s.genTxt, custGender === g && s.genTxA]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Results */}
        {bmi && zone ? (
          <>
            <View style={s.card}>
              <BMIGauge bmi={bmi} color={zone.color} />
              <Text style={{ fontFamily: F.serif, fontSize: 22, color: zone.color, textAlign: 'center', marginBottom: 16 }}>{zone.label}</Text>

              {/* Zone reference bar */}
              <View style={{ flexDirection: 'row', gap: 3, marginBottom: 12 }}>
                {BMI_ZONES.map(z => (
                  <View key={z.label} style={{ flex: z.label === 'Underweight' ? 1 : z.label === 'Normal' ? 1.8 : z.label === 'Overweight' ? 1.5 : 2, height: 6, backgroundColor: z.color, borderRadius: 3, opacity: z.label === zone.label ? 1 : 0.35 }} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {BMI_ZONES.map(z => (
                  <Text key={z.label} style={{ fontFamily: F.mono, fontSize: 8, color: z.label === zone.label ? z.color : mc.text3 }}>{z.label}</Text>
                ))}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.label}>BODY METRICS</Text>
              <View style={s.metRow}>
                <View style={s.met}>
                  <Text style={[s.metVal, { color: zone.color }]}>{bmi}</Text>
                  <Text style={s.metLbl}>BMI</Text>
                </View>
                {bodyFat !== null && (
                  <View style={s.met}>
                    <Text style={[s.metVal, { color: accentColor }]}>{bodyFat}%</Text>
                    <Text style={s.metLbl}>EST. BODY FAT</Text>
                  </View>
                )}
                {ideal && (
                  <View style={s.met}>
                    <Text style={[s.metVal, { color: '#4CAF7C', fontSize: 15 }]}>{ideal.min}–{ideal.max} kg</Text>
                    <Text style={s.metLbl}>IDEAL WEIGHT</Text>
                  </View>
                )}
                {diff !== null && diff !== 0 && (
                  <View style={s.met}>
                    <Text style={[s.metVal, { color: '#FFB74D', fontSize: 15 }]}>{Math.abs(diff).toFixed(1)} kg</Text>
                    <Text style={s.metLbl}>{diff < 0 ? 'TO LOSE' : 'TO GAIN'}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.label}>WHAT THIS MEANS</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2, lineHeight: 20 }}>{ZONE_TIPS[zone.label]}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 10, lineHeight: 16 }}>
                ⚠️ BMI is a screening tool, not a diagnostic measure. Muscle mass, age and ethnicity all affect accuracy.
              </Text>
            </View>
          </>
        ) : (
          mode === 'profile' && !profileWeight && !profileHeight ? null : (
            <View style={s.card}>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>
                {mode === 'custom' ? 'Enter weight and height above to calculate.' : 'Profile is missing height or weight data.'}
              </Text>
            </View>
          )
        )}
      </View>
    </ScrollView>
  );
}
