import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { saveProfile } from '../api';
import { markOnboardingDone } from '../auth';

const MONO    = "'JetBrains Mono', monospace";
const DISPLAY = "'Inter', sans-serif";
const GOLD    = '#C9A84C';
const BG      = '#000000';
const CARD    = '#0A0A0A';
const TEXT    = '#E8DCC8';
const TEXT2   = '#8A7A62';
const TEXT3   = '#50422E';
const BORDER  = 'rgba(201,168,76,0.18)';
const BORDER_H= 'rgba(201,168,76,0.38)';
const GOLD_DIM= 'rgba(201,168,76,0.07)';
const ERR     = '#CF6679';

const GOALS = [
  ['fat_loss',     'Fat Loss',          'Burn fat, reduce body weight'],
  ['muscle_gain',  'Muscle Gain',       'Build strength and muscle mass'],
  ['weight_gain',  'Gain Weight',       'Healthy weight & mass increase'],
  ['maintain',     'Maintain Weight',   'Keep current weight, stay healthy'],
  ['health',       'General Health',    'Improve overall wellbeing'],
  ['endurance',    'Build Endurance',   'Boost stamina and cardio fitness'],
];

const ACTIVITY = [
  ['sedentary', 'Sedentary',           'Little to no exercise'],
  ['light',     'Lightly Active',      '1–3 days of exercise / week'],
  ['moderate',  'Moderately Active',   '3–5 days of exercise / week'],
  ['active',    'Very Active',         'Hard exercise 6–7 days / week'],
  ['athlete',   'Athlete Level',       'Twice daily or physical job'],
];

const MOBILITY = [
  ['none',        'No Limitations',          'Full range of movement'],
  ['low_impact',  'Low-impact Preferred',    'Avoid high-impact activities'],
  ['joint',       'Joint / Mobility Issues', 'Joint pain or limited range'],
  ['wheelchair',  'Wheelchair / Aid',        'Wheelchair or mobility aid user'],
];

const GENDERS = [['male','Male'],['female','Female'],['other','Other'],['prefer_not','Prefer not to say']];

const FOOD_TAGS = [
  'Vegetarian','Vegan','Chicken','Red Meat','Seafood','Eggs','Rice','Bread / Wheat',
  'Lentils & Legumes','Dairy','Indian','Mediterranean','East Asian','Italian',
  'Low Carb','High Protein','Spicy','Sweet',
];

const TOTAL_STEPS = 5;

function ProgressBar({ step }) {
  return (
    <View style={st.progressRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View key={i} style={[st.progressDot, i < step && { backgroundColor: GOLD }]} />
      ))}
    </View>
  );
}

function OptionCard({ label, sub, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[st.optCard, selected && st.optCardSel]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[st.optLabel, selected && { color: GOLD }]}>{label}</Text>
      {!!sub && <Text style={st.optSub}>{sub}</Text>}
    </TouchableOpacity>
  );
}

export default function OnboardingScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Step 1 — gender + age
  const [gender, setGender] = useState('');
  const [age,    setAge]    = useState('');

  // Step 2 — body stats
  const [heightUnit, setHeightUnit] = useState('cm'); // 'cm' | 'ft'
  const [heightCm,   setHeightCm]   = useState('');
  const [heightFt,   setHeightFt]   = useState('');
  const [heightIn,   setHeightIn]   = useState('');
  const [weightKg,   setWeightKg]   = useState('');
  const [targetKg,   setTargetKg]   = useState('');

  function switchHeightUnit(unit) {
    if (unit === heightUnit) return;
    if (unit === 'ft') {
      // cm → ft+in
      const cm = parseFloat(heightCm);
      if (!isNaN(cm) && cm > 0) {
        const totalIn = cm / 2.54;
        setHeightFt(String(Math.floor(totalIn / 12)));
        setHeightIn(String(Math.round(totalIn % 12)));
      }
    } else {
      // ft+in → cm
      const ft = parseFloat(heightFt) || 0;
      const ins = parseFloat(heightIn) || 0;
      if (ft > 0 || ins > 0) {
        setHeightCm(String(Math.round((ft * 12 + ins) * 2.54)));
      }
    }
    setHeightUnit(unit);
  }

  function resolvedHeightCm() {
    if (heightUnit === 'cm') return parseFloat(heightCm);
    const ft = parseFloat(heightFt) || 0;
    const ins = parseFloat(heightIn) || 0;
    return Math.round((ft * 12 + ins) * 2.54);
  }

  // Step 3 — goals (multi-select)
  const [goals, setGoals] = useState([]);
  function toggleGoal(v) { setGoals(prev => prev.includes(v) ? prev.filter(g => g !== v) : [...prev, v]); }

  // Step 4 — lifestyle
  const [activity, setActivity] = useState('');
  const [mobility, setMobility] = useState('');

  // Weight unit toggle
  const [weightUnit,  setWeightUnit]  = useState('kg'); // 'kg' | 'lbs'
  const [weightLbs,   setWeightLbs]   = useState('');
  const [targetLbs,   setTargetLbs]   = useState('');

  function switchWeightUnit(unit) {
    if (unit === weightUnit) return;
    if (unit === 'lbs') {
      const kg = parseFloat(weightKg);
      if (!isNaN(kg) && kg > 0) setWeightLbs(String(Math.round(kg * 2.20462)));
      const tkg = parseFloat(targetKg);
      if (!isNaN(tkg) && tkg > 0) setTargetLbs(String(Math.round(tkg * 2.20462)));
    } else {
      const lbs = parseFloat(weightLbs);
      if (!isNaN(lbs) && lbs > 0) setWeightKg(String(Math.round(lbs / 2.20462)));
      const tlbs = parseFloat(targetLbs);
      if (!isNaN(tlbs) && tlbs > 0) setTargetKg(String(Math.round(tlbs / 2.20462)));
    }
    setWeightUnit(unit);
  }

  function resolvedWeightKg()  { return weightUnit === 'kg' ? parseFloat(weightKg)  : parseFloat(weightLbs)  / 2.20462; }
  function resolvedTargetKg()  { return weightUnit === 'kg' ? parseFloat(targetKg)  : parseFloat(targetLbs)  / 2.20462; }

  // Step 5 — food
  const [foodPrefs, setFoodPrefs] = useState([]);

  function toggleFood(tag) {
    setFoodPrefs(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function next() {
    setError('');
    if (step === 1 && !gender) { setError('Please select your gender.'); return; }
    if (step === 1 && (!age || isNaN(Number(age)) || Number(age) < 10 || Number(age) > 120)) { setError('Please enter a valid age.'); return; }
    if (step === 2 && isNaN(resolvedHeightCm())) { setError('Please enter your height.'); return; }
    if (step === 2 && (heightUnit === 'cm' ? !heightCm : (!heightFt && !heightIn))) { setError('Please enter your height.'); return; }
    if (step === 2 && isNaN(resolvedWeightKg())) { setError('Please enter your current weight.'); return; }
    if (step === 2 && (weightUnit === 'kg' ? !weightKg : !weightLbs)) { setError('Please enter your current weight.'); return; }
    if (step === 3 && goals.length === 0) { setError('Please pick at least one goal.'); return; }
    if (step === 4 && !activity) { setError('Please pick your activity level.'); return; }
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return; }
    finish();
  }

  async function finish() {
    setSaving(true);
    setError('');
    try {
      const hcm = resolvedHeightCm();
      const wkg = resolvedWeightKg();
      const tkg = resolvedTargetKg();
      await saveProfile({
        gender,
        age:              Number(age),
        height_cm:        Math.round(hcm),
        weight_kg:        Math.round(wkg * 10) / 10,
        target_weight_kg: (!isNaN(tkg) && tkg > 0) ? Math.round(tkg * 10) / 10 : undefined,
        goal: goals.join(', '),
        activity_level:   activity,
        mobility_note:    mobility,
        food_prefs:       foodPrefs.join(', '),
      });
    } catch {}
    await markOnboardingDone();
    setSaving(false);
    navigation.navigate('dashboard');
  }

  async function skip() {
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return; }
    await markOnboardingDone();
    navigation.navigate('dashboard');
  }

  const stepTitles = [
    'About you',
    'Your body',
    'Your goal',
    'Your lifestyle',
    'Food preferences',
  ];
  const stepSubs = [
    'Gender and age help us set accurate baselines.',
    'Used to calculate your targets and daily needs.',
    'Everything we do will be aimed at this.',
    'How active are you day-to-day?',
    'Pick everything that fits — even things you\'re open to trying.',
  ];

  return (
    <View style={st.page}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={st.card}>
          <View style={st.goldAccent} />

          <ProgressBar step={step} />

          <Text style={st.tag}>STEP {step} OF {TOTAL_STEPS}</Text>
          <Text style={st.title}>{stepTitles[step - 1]}</Text>
          <Text style={st.subtitle}>{stepSubs[step - 1]}</Text>

          {/* ── Step 1: Gender + Age ── */}
          {step === 1 && (
            <View>
              <Text style={st.fieldLabel}>Gender</Text>
              <View style={st.chipRow}>
                {GENDERS.map(([v, l]) => (
                  <TouchableOpacity key={v} style={[st.chip, gender === v && st.chipSel]} onPress={() => setGender(v)}>
                    <Text style={[st.chipTxt, gender === v && { color: GOLD }]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[st.fieldLabel, { marginTop: 24 }]}>Age</Text>
              <View style={st.numRow}>
                <TouchableOpacity style={st.stepperBtn} onPress={() => setAge(v => String(Math.max(10, Number(v || 18) - 1)))}>
                  <Text style={st.stepperTxt}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={st.numInput}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  placeholder="25"
                  placeholderTextColor={TEXT3}
                />
                <Text style={st.numUnit}>yrs</Text>
                <TouchableOpacity style={st.stepperBtn} onPress={() => setAge(v => String(Math.min(120, Number(v || 18) + 1)))}>
                  <Text style={st.stepperTxt}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Step 2: Body stats ── */}
          {step === 2 && (
            <View>
              {/* Height */}
              <View style={st.labelRow}>
                <Text style={st.fieldLabel}>Height</Text>
                <View style={st.unitToggle}>
                  {['cm','ft'].map(u => (
                    <TouchableOpacity key={u} style={[st.unitBtn, heightUnit === u && st.unitBtnSel]} onPress={() => switchHeightUnit(u)}>
                      <Text style={[st.unitBtnTxt, heightUnit === u && { color: BG }]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {heightUnit === 'cm' ? (
                <View style={st.numRow}>
                  <TextInput style={[st.numInput, { flex: 1, textAlign: 'left', paddingHorizontal: 4 }]} value={heightCm} onChangeText={setHeightCm} keyboardType="decimal-pad" placeholder="170" placeholderTextColor={TEXT3} />
                  <Text style={st.numUnit}>cm</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={[st.numRow, { flex: 1 }]}>
                    <TextInput style={[st.numInput, { flex: 1, textAlign: 'left', paddingHorizontal: 4 }]} value={heightFt} onChangeText={setHeightFt} keyboardType="number-pad" placeholder="5" placeholderTextColor={TEXT3} />
                    <Text style={st.numUnit}>ft</Text>
                  </View>
                  <View style={[st.numRow, { flex: 1 }]}>
                    <TextInput style={[st.numInput, { flex: 1, textAlign: 'left', paddingHorizontal: 4 }]} value={heightIn} onChangeText={setHeightIn} keyboardType="number-pad" placeholder="8" placeholderTextColor={TEXT3} />
                    <Text style={st.numUnit}>in</Text>
                  </View>
                </View>
              )}

              {/* Current weight */}
              <View style={[st.labelRow, { marginTop: 20 }]}>
                <Text style={st.fieldLabel}>Current weight</Text>
                <View style={st.unitToggle}>
                  {['kg','lbs'].map(u => (
                    <TouchableOpacity key={u} style={[st.unitBtn, weightUnit === u && st.unitBtnSel]} onPress={() => switchWeightUnit(u)}>
                      <Text style={[st.unitBtnTxt, weightUnit === u && { color: BG }]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={st.numRow}>
                <TextInput style={[st.numInput, { flex: 1, textAlign: 'left', paddingHorizontal: 4 }]} value={weightUnit === 'kg' ? weightKg : weightLbs} onChangeText={weightUnit === 'kg' ? setWeightKg : setWeightLbs} keyboardType="decimal-pad" placeholder={weightUnit === 'kg' ? '70' : '154'} placeholderTextColor={TEXT3} />
                <Text style={st.numUnit}>{weightUnit}</Text>
              </View>

              {/* Target weight */}
              <Text style={[st.fieldLabel, { marginTop: 20 }]}>Target weight <Text style={{ color: TEXT3, fontSize: 10 }}>(optional)</Text></Text>
              <View style={st.numRow}>
                <TextInput style={[st.numInput, { flex: 1, textAlign: 'left', paddingHorizontal: 4 }]} value={weightUnit === 'kg' ? targetKg : targetLbs} onChangeText={weightUnit === 'kg' ? setTargetKg : setTargetLbs} keyboardType="decimal-pad" placeholder={weightUnit === 'kg' ? '65' : '143'} placeholderTextColor={TEXT3} />
                <Text style={st.numUnit}>{weightUnit}</Text>
              </View>
            </View>
          )}

          {/* ── Step 3: Goal (multi-select) ── */}
          {step === 3 && (
            <View>
              <Text style={{ fontFamily: MONO, fontSize: 10, color: TEXT3, letterSpacing: 2, marginBottom: 14 }}>
                Select all that apply
              </Text>
              <View style={st.optList}>
                {GOALS.map(([v, l, s]) => (
                  <OptionCard key={v} label={l} sub={s} selected={goals.includes(v)} onPress={() => toggleGoal(v)} />
                ))}
              </View>
            </View>
          )}

          {/* ── Step 4: Activity + Mobility ── */}
          {step === 4 && (
            <View>
              <Text style={st.fieldLabel}>Activity level</Text>
              <View style={st.optList}>
                {ACTIVITY.map(([v, l, s]) => (
                  <OptionCard key={v} label={l} sub={s} selected={activity === v} onPress={() => setActivity(v)} />
                ))}
              </View>

              <Text style={[st.fieldLabel, { marginTop: 20 }]}>Mobility</Text>
              <View style={st.optList}>
                {MOBILITY.map(([v, l, s]) => (
                  <OptionCard key={v} label={l} sub={s} selected={mobility === v} onPress={() => setMobility(v)} />
                ))}
              </View>
            </View>
          )}

          {/* ── Step 5: Food prefs ── */}
          {step === 5 && (
            <View style={st.foodGrid}>
              {FOOD_TAGS.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[st.foodTag, foodPrefs.includes(tag) && st.foodTagSel]}
                  onPress={() => toggleFood(tag)}
                >
                  <Text style={[st.foodTagTxt, foodPrefs.includes(tag) && { color: BG, fontWeight: '700' }]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!!error && <Text style={st.error}>{error}</Text>}

          <View style={st.btnRow}>
            <TouchableOpacity style={st.skipBtn} onPress={skip}>
              <Text style={st.skipTxt}>{step === TOTAL_STEPS ? 'Skip' : 'Skip step'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.nextBtn, saving && { opacity: 0.6 }]} onPress={next} disabled={saving}>
              <Text style={st.nextTxt}>{saving ? 'Saving…' : step === TOTAL_STEPS ? 'Finish' : 'Next →'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  page:   { flex: 1, backgroundColor: BG },
  scroll: { alignItems: 'center', padding: 20, paddingBottom: 60 },
  card:   { width: '100%', maxWidth: 480, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, padding: 40, position: 'relative', marginTop: 20 },
  goldAccent: { position: 'absolute', top: 0, left: 0, width: 40, height: 2, backgroundColor: GOLD },

  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressDot:  { width: 24, height: 3, backgroundColor: 'rgba(201,168,76,0.2)' },

  tag:      { fontFamily: MONO, color: TEXT3, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12 },
  title:    { fontFamily: DISPLAY, color: TEXT, fontSize: 26, letterSpacing: 0.5, marginBottom: 6 },
  subtitle: { fontFamily: MONO, color: TEXT2, fontSize: 12, lineHeight: 20, letterSpacing: 0.3, fontStyle: 'italic', marginBottom: 28 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    { paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: '#161616' },
  chipSel: { borderColor: GOLD, backgroundColor: GOLD_DIM },
  chipTxt: { fontFamily: MONO, fontSize: 12, color: TEXT2, letterSpacing: 0.5 },

  labelRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  fieldLabel: { fontFamily: MONO, color: TEXT2, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 0 },
  unitToggle: { flexDirection: 'row', gap: 0 },
  unitBtn:    { paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: '#161616' },
  unitBtnSel: { backgroundColor: GOLD, borderColor: GOLD },
  unitBtnTxt: { fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: 1 },

  numRow:     { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.22)', gap: 4 },
  numInput:   { fontFamily: MONO, fontSize: 22, color: TEXT, paddingVertical: 10, minWidth: 60, textAlign: 'center', outlineWidth: 0, backgroundColor: 'transparent' },
  numUnit:    { fontFamily: MONO, fontSize: 11, color: TEXT3, letterSpacing: 1 },
  stepperBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  stepperTxt: { fontFamily: MONO, fontSize: 20, color: TEXT2 },

  optList:    { gap: 8 },
  optCard:    { paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: '#161616' },
  optCardSel: { borderColor: GOLD, backgroundColor: GOLD_DIM },
  optLabel:   { fontFamily: MONO, fontSize: 13, color: TEXT, letterSpacing: 0.3, marginBottom: 2 },
  optSub:     { fontFamily: MONO, fontSize: 10, color: TEXT3, letterSpacing: 0.2 },

  foodGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foodTag:    { paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: '#161616' },
  foodTagSel: { backgroundColor: GOLD, borderColor: GOLD },
  foodTagTxt: { fontFamily: MONO, fontSize: 12, color: TEXT2, letterSpacing: 0.3 },

  error:  { color: ERR, fontFamily: MONO, fontSize: 12, letterSpacing: 0.5, marginTop: 12, marginBottom: 4 },

  btnRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 4 },
  skipTxt: { fontFamily: MONO, fontSize: 11, color: TEXT3, letterSpacing: 1 },
  nextBtn: { paddingVertical: 12, paddingHorizontal: 28, backgroundColor: GOLD },
  nextTxt: { fontFamily: MONO, fontSize: 12, fontWeight: '700', color: BG, letterSpacing: 2, textTransform: 'uppercase' },
});
