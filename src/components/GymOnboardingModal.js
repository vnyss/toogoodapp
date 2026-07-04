import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, F } from '../theme';
import { getUser } from '../auth';

export const LIFTS = [
  { key: 'bench',    label: 'Bench Press' },
  { key: 'squat',    label: 'Squat' },
  { key: 'deadlift', label: 'Deadlift' },
  { key: 'overhead', label: 'Overhead Press' },
  { key: 'legPress', label: 'Leg Press' },
];

export function gymProfileKey(user) { return `tg_gym_profile_${user}`; }

// Mount this once near the top of Workout Tracker / Gym Progress — it shows itself
// automatically the first time either screen is opened, then never again.
// Pass forceOpen + onClose to reuse it as an "edit my gym profile" dialog later.
export default function GymOnboardingModal({ onComplete, forceOpen, onClose, existingProfile }) {
  const [user,    setUser]    = useState(null);
  const [visible, setVisible] = useState(false);
  const [step,    setStep]    = useState('level'); // 'level' | 'maxes'
  const [level,   setLevel]   = useState(null);
  const [maxes,   setMaxes]   = useState({ bench: '', squat: '', deadlift: '', overhead: '', legPress: '' });

  useEffect(() => {
    getUser().then(async u => {
      setUser(u);
      const raw = await AsyncStorage.getItem(gymProfileKey(u));
      if (!raw) setVisible(true);
    });
  }, []);

  useEffect(() => {
    if (forceOpen) {
      setStep('level');
      setLevel(existingProfile?.level || null);
      setMaxes({
        bench: existingProfile?.maxes?.bench ? String(existingProfile.maxes.bench) : '',
        squat: existingProfile?.maxes?.squat ? String(existingProfile.maxes.squat) : '',
        deadlift: existingProfile?.maxes?.deadlift ? String(existingProfile.maxes.deadlift) : '',
        overhead: existingProfile?.maxes?.overhead ? String(existingProfile.maxes.overhead) : '',
        legPress: existingProfile?.maxes?.legPress ? String(existingProfile.maxes.legPress) : '',
      });
      setVisible(true);
    }
  }, [forceOpen]);

  async function chooseLevel(lvl) {
    setLevel(lvl);
    if (lvl === 'beginner') {
      await save({ level: lvl, maxes: {}, completedAt: new Date().toISOString() });
    } else {
      setStep('maxes');
    }
  }

  async function save(profile) {
    if (!user) return;
    await AsyncStorage.setItem(gymProfileKey(user), JSON.stringify(profile));
    setVisible(false);
    onComplete && onComplete(profile);
    onClose && onClose();
  }

  async function finishMaxes() {
    const cleaned = {};
    LIFTS.forEach(l => { const n = parseFloat(maxes[l.key]); if (!isNaN(n) && n > 0) cleaned[l.key] = n; });
    await save({ level, maxes: cleaned, completedAt: new Date().toISOString() });
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.box}>
          {forceOpen && (
            <TouchableOpacity style={s.closeX} onPress={() => { setVisible(false); onClose && onClose(); }}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth={1.8} strokeLinecap="round">
                <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
              </Svg>
            </TouchableOpacity>
          )}
          {step === 'level' && (
            <>
              <Text style={s.title}>{forceOpen ? 'Edit your gym profile' : 'Welcome to the gym'}</Text>
              <Text style={s.sub}>What's your experience level? This helps us tailor your workouts.</Text>
              {[
                { k: 'beginner',     l: 'Beginner',     d: "New to the gym or lifting under 6 months." },
                { k: 'intermediate', l: 'Intermediate', d: "Comfortable with form, lifting 6 months–2 years." },
                { k: 'advanced',     l: 'Advanced',     d: "Experienced lifter, 2+ years of consistent training." },
              ].map(o => (
                <TouchableOpacity key={o.k} style={[s.option, level === o.k && s.optionA]} onPress={() => chooseLevel(o.k)}>
                  <Text style={s.optionLabel}>{o.l}</Text>
                  <Text style={s.optionDesc}>{o.d}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {step === 'maxes' && (
            <>
              <Text style={s.title}>Your current maxes</Text>
              <Text style={s.sub}>Optional — enter your 1-rep max (kg) for any lifts you know. Skip what you don't.</Text>
              {LIFTS.map(l => (
                <View key={l.key} style={s.maxRow}>
                  <Text style={s.maxLabel}>{l.label}</Text>
                  <TextInput
                    style={s.maxInput}
                    value={maxes[l.key]}
                    onChangeText={v => setMaxes(m => ({ ...m, [l.key]: v }))}
                    placeholder="kg"
                    placeholderTextColor={C.text3}
                    keyboardType="numeric"
                  />
                </View>
              ))}
              <TouchableOpacity style={s.saveBtn} onPress={finishMaxes}>
                <Text style={s.saveBtnTxt}>SAVE & CONTINUE</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  box:         { width: 440, maxWidth: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderH, padding: 28 },
  title:       { fontFamily: F.display, fontSize: 19, color: C.text, letterSpacing: 0.5, marginBottom: 8 },
  sub:         { fontFamily: F.mono, fontSize: 12, color: C.text2, lineHeight: 18, marginBottom: 20 },
  closeX:      { position: 'absolute', top: 14, right: 14, padding: 6, zIndex: 1, alignItems: 'center', justifyContent: 'center' },
  option:      { borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  optionA:     { borderColor: C.gold, backgroundColor: C.goldDim },
  optionLabel: { fontFamily: F.mono, fontSize: 13, color: C.gold, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  optionDesc:  { fontFamily: F.mono, fontSize: 11, color: C.text3, lineHeight: 15 },
  maxRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 10 },
  maxLabel:    { fontFamily: F.mono, fontSize: 12, color: C.text },
  maxInput:    { fontFamily: F.mono, fontSize: 13, color: C.text, borderBottomWidth: 1, borderBottomColor: C.borderH, width: 80, textAlign: 'right', paddingVertical: 4, outlineWidth: 0 },
  saveBtn:     { backgroundColor: C.gold, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  saveBtnTxt:  { fontFamily: F.mono, fontSize: 11, color: '#060606', fontWeight: '700', letterSpacing: 2.5 },
});
