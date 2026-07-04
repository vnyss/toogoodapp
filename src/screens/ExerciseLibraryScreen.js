import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { EXERCISES, MUSCLE_GROUPS, EQUIPMENT } from '../data/exercises';

const MUSCLE_COLORS = {
  Chest: '#E57373', Back: '#7C8BF5', Shoulders: '#FFB74D', Biceps: '#4CAF7C',
  Triceps: '#26C6DA', Core: '#AB47BC', Quads: '#FF7043', Hamstrings: '#78909C',
  Glutes: '#EC407A', Calves: '#8D6E63', 'Full Body': '#FFD700', Cardio: '#42A5F5',
  Traps: '#9CCC65', Forearms: '#FFA726', Obliques: '#66BB6A',
};

function Tag({ label }) {
  const col = MUSCLE_COLORS[label] || '#888';
  return (
    <View style={{ backgroundColor: col + '22', borderWidth: 1, borderColor: col + '44', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 3, marginRight: 4, marginBottom: 4 }}>
      <Text style={{ fontFamily: F.mono, fontSize: 9, color: col }}>{label}</Text>
    </View>
  );
}

export default function ExerciseLibraryScreen() {
  const { mc, accentColor } = useTheme();
  const [search,    setSearch]    = useState('');
  const [muscle,    setMuscle]    = useState('All');
  const [equipment, setEquipment] = useState('All');
  const [detail,    setDetail]    = useState(null);

  const filtered = EXERCISES.filter(ex =>
    (muscle    === 'All' || ex.muscles.some(m => m.toLowerCase().includes(muscle.toLowerCase()))) &&
    (equipment === 'All' || ex.equipment === equipment) &&
    (search    === ''    || ex.name.toLowerCase().includes(search.toLowerCase()))
  );

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 16, maxWidth: 700, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 16 },
    input:   { borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, fontSize: 13, color: mc.text, marginBottom: 10 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 6 },
    chip:    { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: mc.border, marginRight: 6, marginBottom: 6 },
    chipA:   { borderColor: accentColor, backgroundColor: accentColor + '18' },
    chipTxt: { fontFamily: F.mono, fontSize: 10, color: mc.text3 },
    chipTxA: { color: accentColor },
    exCard:  { borderWidth: 1, borderColor: mc.border, padding: 14, marginBottom: 10 },
    exName:  { fontFamily: F.mono, fontSize: 13, color: mc.text, marginBottom: 6 },
    exEq:    { fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 6 },
    tags:    { flexDirection: 'row', flexWrap: 'wrap' },
    backBtn: { paddingVertical: 10, marginBottom: 16 },
    backTxt: { fontFamily: F.mono, fontSize: 12, color: accentColor },
    count:   { fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 14 },
  });

  if (detail) {
    const tips = {
      Barbell:    'Set up in a power rack. Warm up with lighter weight before working sets.',
      Dumbbell:   'Control the weight on both sides. Don\'t rush the lowering phase.',
      Bodyweight: 'Focus on form over speed. Progress by increasing reps or adding weight.',
      Cable:      'Cables maintain constant tension throughout the movement.',
      Machine:    'Good for isolation. Adjust seat height before starting.',
      Kettlebell: 'Drive through your hips on ballistic movements. Keep wrists neutral.',
    };
    return (
      <ScrollView style={s.root}>
        <View style={s.content}>
          <TouchableOpacity style={s.backBtn} onPress={() => setDetail(null)}>
            <Text style={s.backTxt}>← Back to library</Text>
          </TouchableOpacity>
          <Text style={s.title}>{detail.name}</Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3, marginBottom: 16 }}>{detail.equipment} · {detail.category}</Text>

          <View style={{ borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 }}>
            <Text style={[s.label, { marginBottom: 10 }]}>PRIMARY MUSCLES</Text>
            <View style={s.tags}>{detail.muscles.map(m => <Tag key={m} label={m} />)}</View>
          </View>

          <View style={{ borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 }}>
            <Text style={s.label}>EQUIPMENT</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text }}>{detail.equipment}</Text>
            {tips[detail.equipment] && (
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginTop: 8, lineHeight: 18 }}>
                {tips[detail.equipment]}
              </Text>
            )}
          </View>

          <View style={{ borderWidth: 1, borderColor: mc.border, padding: 16 }}>
            <Text style={s.label}>RECOMMENDED SETS & REPS</Text>
            {detail.category === 'Cardio' ? (
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2 }}>20–60 minutes at moderate intensity</Text>
            ) : (
              <>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2, marginBottom: 6 }}>Strength:  3–5 sets × 1–5 reps (85–100% 1RM)</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2, marginBottom: 6 }}>Hypertrophy: 3–4 sets × 8–12 reps (65–80% 1RM)</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2 }}>Endurance: 2–3 sets × 15–25 reps (50–65% 1RM)</Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.root} keyboardShouldPersistTaps="handled">
      <View style={s.content}>
        <Text style={s.title}>Exercise Library</Text>
        <Text style={s.sub}>{EXERCISES.length} EXERCISES</Text>

        <TextInput
          style={s.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises…"
          placeholderTextColor={mc.text3}
        />

        <Text style={s.label}>MUSCLE GROUP</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {MUSCLE_GROUPS.map(m => (
            <TouchableOpacity key={m} style={[s.chip, muscle === m && s.chipA]} onPress={() => setMuscle(m)}>
              <Text style={[s.chipTxt, muscle === m && s.chipTxA]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={s.label}>EQUIPMENT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {EQUIPMENT.map(e => (
            <TouchableOpacity key={e} style={[s.chip, equipment === e && s.chipA]} onPress={() => setEquipment(e)}>
              <Text style={[s.chipTxt, equipment === e && s.chipTxA]}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={s.count}>{filtered.length} exercise{filtered.length !== 1 ? 's' : ''} found</Text>

        {filtered.map(ex => (
          <TouchableOpacity key={ex.id} style={s.exCard} onPress={() => setDetail(ex)}>
            <Text style={s.exName}>{ex.name}</Text>
            <Text style={s.exEq}>{ex.equipment} · {ex.category}</Text>
            <View style={s.tags}>{ex.muscles.map(m => <Tag key={m} label={m} />)}</View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
