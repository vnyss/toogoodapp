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
  const SIZE = 200;
  const R = 80;
  const cx = SIZE / 2, cy = SIZE / 2 + 20;
  const clampedBMI = Math.min(Math.max(bmi, 15), 40);
  const pct = (clampedBMI - 15) / 25;
  const angle = -180 + pct * 180;
  const rad = (angle * Math.PI) / 180;
  const nx = cx + R * Math.cos(rad);
  const ny = cy + R * Math.sin(rad);

  return (
    <View style={{ alignItems: 'center', marginBottom: 10 }}>
      <Svg width={SIZE} height={SIZE / 2 + 40}>
        {/* Arc segments */}
        {BMI_ZONES.map((z, i) => {
          const startPct = (Math.max(z.min, 15) - 15) / 25;
          const endPct   = (Math.min(z.max, 40) - 15) / 25;
          const sa = (-180 + startPct * 180) * Math.PI / 180;
          const ea = (-180 + endPct * 180) * Math.PI / 180;
          const x1 = cx + R * Math.cos(sa);
          const y1 = cy + R * Math.sin(sa);
          const x2 = cx + R * Math.cos(ea);
          const y2 = cy + R * Math.sin(ea);
          const largeArc = (endPct - startPct) > 0.5 ? 1 : 0;
          return (
            <Path
              key={i}
              d={`M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`}
              stroke={z.color} strokeWidth={16} fill="none" strokeLinecap="round"
            />
          );
        })}
        {/* Needle */}
        <Line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={cx} cy={cy} r={6} fill={color} />
        {/* Labels */}
        <Path d={`M ${cx - R - 8} ${cy} L ${cx - R + 4} ${cy}`} stroke="#888" strokeWidth={1} />
        <Path d={`M ${cx + R - 4} ${cy} L ${cx + R + 8} ${cy}`} stroke="#888" strokeWidth={1} />
      </Svg>
      <Text style={{ fontFamily: F.mono, fontSize: 44, fontWeight: '700', color, marginTop: -20 }}>{bmi.toFixed(1)}</Text>
    </View>
  );
}

function calcBodyFat(bmi, age, gender) {
  // Deurenberg formula
  const a = parseFloat(age) || 25;
  const isMale = (gender || '').toLowerCase() !== 'female';
  return Math.round((1.2 * bmi + 0.23 * a - 10.8 * (isMale ? 1 : 0) - 5.4) * 10) / 10;
}

function idealWeightRange(heightCm, gender) {
  const h = parseFloat(heightCm);
  if (!h) return null;
  const hM = h / 100;
  const minBMI = 18.5, maxBMI = 24.9;
  return {
    min: Math.round(minBMI * hM * hM),
    max: Math.round(maxBMI * hM * hM),
  };
}

export default function BMIScreen() {
  const { mc, accentColor } = useTheme();
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age,    setAge]    = useState('');
  const [gender, setGender] = useState('male');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
        const res = await fetch(API_BASE + '/api/v1/me', { headers });
        const d = await res.json();
        if (d.weight_kg) setWeight(String(d.weight_kg));
        if (d.height_cm) setHeight(String(d.height_cm));
        if (d.age)       setAge(String(d.age));
        if (d.gender)    setGender(d.gender.toLowerCase());
        setLoaded(true);
      } catch { setLoaded(true); }
    }
    load();
  }, []);

  const w  = parseFloat(weight);
  const h  = parseFloat(height);
  const bmi = (w && h) ? Math.round((w / ((h / 100) ** 2)) * 10) / 10 : null;
  const zone = bmi ? getBMIZone(bmi) : null;
  const bodyFat = bmi ? calcBodyFat(bmi, age, gender) : null;
  const ideal = h ? idealWeightRange(h, gender) : null;
  const toIdeal = bmi && ideal ? (bmi > 24.9 ? -(w - ideal.max) : bmi < 18.5 ? ideal.min - w : 0) : null;

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 20, maxWidth: 560, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 24 },
    row:     { flexDirection: 'row', gap: 12, marginBottom: 12 },
    field:   { flex: 1 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 6 },
    input:   { borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, fontSize: 14, color: mc.text },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 12 },
    metRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 12 },
    met:     { alignItems: 'center', minWidth: 80 },
    metVal:  { fontFamily: F.mono, fontSize: 22, fontWeight: '700' },
    metLbl:  { fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 1, marginTop: 2 },
    zoneRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    zoneBar: { height: 8, flex: 1, marginRight: 2, borderRadius: 4 },
    genRow:  { flexDirection: 'row', gap: 8 },
    genBtn:  { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: mc.border },
    genBtnA: { borderColor: accentColor, backgroundColor: accentColor + '18' },
    genTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    genTxA:  { color: accentColor },
  });

  return (
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>BMI & Body Metrics</Text>
        <Text style={s.sub}>CALCULATE YOUR BODY METRICS</Text>

        <View style={s.row}>
          <View style={s.field}>
            <Text style={s.label}>WEIGHT (KG)</Text>
            <TextInput style={s.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="e.g. 70" placeholderTextColor={mc.text3} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>HEIGHT (CM)</Text>
            <TextInput style={s.input} value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="e.g. 170" placeholderTextColor={mc.text3} />
          </View>
        </View>

        <View style={s.row}>
          <View style={s.field}>
            <Text style={s.label}>AGE</Text>
            <TextInput style={s.input} value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="e.g. 28" placeholderTextColor={mc.text3} />
          </View>
          <View style={[s.field, { justifyContent: 'flex-end' }]}>
            <Text style={s.label}>GENDER</Text>
            <View style={s.genRow}>
              {['male', 'female'].map(g => (
                <TouchableOpacity key={g} style={[s.genBtn, gender === g && s.genBtnA]} onPress={() => setGender(g)}>
                  <Text style={[s.genTxt, gender === g && s.genTxA]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {bmi && zone && (
          <>
            <View style={s.card}>
              <BMIGauge bmi={bmi} color={zone.color} />
              <Text style={{ fontFamily: F.serif, fontSize: 20, color: zone.color, textAlign: 'center' }}>{zone.label}</Text>

              {/* Zone reference */}
              <View style={{ marginTop: 16 }}>
                {BMI_ZONES.map((z, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View style={{ width: 12, height: 12, backgroundColor: z.color, borderRadius: 2, marginRight: 8 }} />
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text2, flex: 1 }}>{z.label}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{z.min}–{z.max < 99 ? z.max : '+'}</Text>
                  </View>
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
                    <Text style={s.metLbl}>BODY FAT</Text>
                  </View>
                )}
                {ideal && (
                  <View style={s.met}>
                    <Text style={[s.metVal, { color: '#4CAF7C', fontSize: 16 }]}>{ideal.min}–{ideal.max} kg</Text>
                    <Text style={s.metLbl}>IDEAL WEIGHT</Text>
                  </View>
                )}
                {toIdeal !== null && toIdeal !== 0 && (
                  <View style={s.met}>
                    <Text style={[s.metVal, { color: '#FFB74D', fontSize: 16 }]}>{Math.abs(toIdeal.toFixed(1))} kg</Text>
                    <Text style={s.metLbl}>{toIdeal < 0 ? 'TO LOSE' : 'TO GAIN'}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.label}>WHAT YOUR BMI MEANS</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2, lineHeight: 20 }}>
                {zone.label === 'Underweight' && 'You may need to gain weight. Focus on nutrient-dense, calorie-rich foods. Consider consulting a dietitian.'}
                {zone.label === 'Normal' && 'Your BMI is in the healthy range. Maintain your current habits with balanced diet and regular exercise.'}
                {zone.label === 'Overweight' && 'You are slightly above the healthy range. Modest calorie reduction and more physical activity can help.'}
                {zone.label === 'Obese' && 'Your BMI indicates obesity. This increases risk of chronic disease. A structured diet and exercise plan with medical support is recommended.'}
              </Text>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 10 }}>
                ⚠️ BMI is a screening tool, not a diagnostic measure. Muscle mass, age, and ethnicity affect accuracy.
              </Text>
            </View>
          </>
        )}

        {!bmi && loaded && (
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3, textAlign: 'center', marginTop: 20 }}>
            Enter your weight and height above to calculate your BMI.{'\n'}
            Your profile values have been pre-filled if available.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
