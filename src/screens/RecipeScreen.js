import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Modal, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';
import { searchFood } from '../api';

export default function RecipeScreen({ navigation }) {
  const { mc, accentColor } = useTheme();
  const [recipes,     setRecipes]     = useState([]);
  const [storageKey,  setStorageKey]  = useState(null);
  const [view,        setView]        = useState('list');   // 'list' | 'build'
  const [name,        setName]        = useState('');
  const [servings,    setServings]    = useState('1');
  const [ingredients, setIngredients] = useState([]);
  const [searchQ,     setSearchQ]     = useState('');
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [editQtyIdx,  setEditQtyIdx]  = useState(null);
  const [editQty,     setEditQty]     = useState('');
  const [detail,      setDetail]      = useState(null);    // recipe detail view
  const timerRef = useRef(null);

  useEffect(() => {
    getUser().then(async u => {
      const key = `tg_recipes_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) setRecipes(JSON.parse(raw));
    });
  }, []);

  async function persist(updated) {
    if (!storageKey) return;
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
  }

  function onSearch(q) {
    setSearchQ(q);
    clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchFood(q)); } catch {}
      setSearching(false);
    }, 400);
  }

  function addIngredient(item) {
    setIngredients(prev => [...prev, { ...item, qty: 100 }]);
    setSearchQ(''); setResults([]);
  }

  function removeIngredient(i) { setIngredients(prev => prev.filter((_, j) => j !== i)); }

  function updateQty(i, qty) {
    setIngredients(prev => prev.map((ing, j) => j !== i ? ing : { ...ing, qty: parseFloat(qty) || 0 }));
  }

  function totalPer(field) {
    return Math.round(ingredients.reduce((s, ing) => s + (ing[field] || 0) * (ing.qty / 100), 0));
  }

  function perServing(field) {
    const sv = parseInt(servings) || 1;
    return Math.round(totalPer(field) / sv);
  }

  function saveRecipe() {
    if (!name.trim() || !ingredients.length) return;
    const r = {
      id:          Date.now(),
      name:        name.trim(),
      servings:    parseInt(servings) || 1,
      ingredients,
      calories:    totalPer('calories'),
      protein:     totalPer('protein'),
      carbs:       totalPer('carbs'),
      fat:         totalPer('fat'),
      calPerSv:    perServing('calories'),
      protPerSv:   perServing('protein'),
      carbsPerSv:  perServing('carbs'),
      fatPerSv:    perServing('fat'),
    };
    const updated = [r, ...recipes];
    setRecipes(updated);
    persist(updated);
    setView('list'); setName(''); setServings('1'); setIngredients([]);
  }

  function deleteRecipe(id) {
    const updated = recipes.filter(r => r.id !== id);
    setRecipes(updated);
    persist(updated);
    setDetail(null);
  }

  const st = StyleSheet.create({
    root:     { flex: 1, backgroundColor: mc.bg },
    content:  { padding: 20, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:    { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:      { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
    label:    { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 6 },
    input:    { borderWidth: 1, borderColor: mc.border, padding: 10, fontFamily: F.mono, fontSize: 13, color: mc.text, marginBottom: 12 },
    ingRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: mc.border },
    macroRow: { flexDirection: 'row', gap: 16, marginTop: 16, marginBottom: 20, padding: 12, borderWidth: 1, borderColor: mc.border },
    macro:    { alignItems: 'center' },
    macroVal: { fontFamily: F.mono, fontSize: 20, fontWeight: '700', color: accentColor },
    macroLbl: { fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 1 },
    saveBtn:  { backgroundColor: accentColor, paddingVertical: 14, alignItems: 'center' },
    saveTxt:  { fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700', letterSpacing: 1 },
    card:     { borderWidth: 1, borderColor: mc.border, padding: 14, marginBottom: 12 },
    cardName: { fontFamily: F.mono, fontSize: 14, color: mc.text, marginBottom: 4 },
    cardSub:  { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    backBtn:  { paddingVertical: 10, marginBottom: 16 },
    backTxt:  { fontFamily: F.mono, fontSize: 12, color: accentColor },
  });

  if (detail) {
    return (
      <ScrollView style={st.root}>
        <View style={st.content}>
          <TouchableOpacity style={st.backBtn} onPress={() => setDetail(null)}>
            <Text style={st.backTxt}>← Back to recipes</Text>
          </TouchableOpacity>
          <Text style={st.title}>{detail.name}</Text>
          <Text style={st.sub}>{detail.servings} serving{detail.servings > 1 ? 's' : ''}</Text>

          <View style={st.macroRow}>
            {[['calories', 'KCAL'], ['protein', 'PROTEIN'], ['carbs', 'CARBS'], ['fat', 'FAT']].map(([f, l]) => (
              <View key={f} style={[st.macro, { flex: 1 }]}>
                <Text style={st.macroVal}>{detail.calPerSv || detail[f]}</Text>
                <Text style={st.macroLbl}>{l}/SV</Text>
              </View>
            ))}
          </View>

          <Text style={[st.label, { marginBottom: 10 }]}>INGREDIENTS</Text>
          {detail.ingredients.map((ing, i) => (
            <View key={i} style={st.ingRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{ing.name}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{ing.qty}g · {Math.round(ing.calories * ing.qty / 100)} kcal</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={[st.saveBtn, { marginTop: 24, backgroundColor: '#E57373' }]} onPress={() => deleteRecipe(detail.id)}>
            <Text style={[st.saveTxt, { color: '#fff' }]}>DELETE RECIPE</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (view === 'build') {
    return (
      <ScrollView style={st.root} keyboardShouldPersistTaps="handled">
        <View style={st.content}>
          <TouchableOpacity style={st.backBtn} onPress={() => setView('list')}>
            <Text style={st.backTxt}>← Back</Text>
          </TouchableOpacity>
          <Text style={st.title}>Build Recipe</Text>

          <Text style={st.label}>RECIPE NAME</Text>
          <TextInput style={st.input} value={name} onChangeText={setName} placeholder="e.g. Dal Tadka, Chicken Salad" placeholderTextColor={mc.text3} />

          <Text style={st.label}>NUMBER OF SERVINGS</Text>
          <TextInput style={[st.input, { width: 100 }]} value={servings} onChangeText={setServings} keyboardType="number-pad" placeholderTextColor={mc.text3} />

          <Text style={st.label}>SEARCH INGREDIENTS</Text>
          <TextInput style={st.input} value={searchQ} onChangeText={onSearch} placeholder="Search food database…" placeholderTextColor={mc.text3} />

          {searching && <ActivityIndicator color={accentColor} style={{ marginBottom: 12 }} />}
          {results.map((item, i) => (
            <TouchableOpacity key={i} onPress={() => addIngredient(item)}
              style={{ paddingVertical: 9, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: mc.border }}>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{item.name}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{item.calories} kcal/100g</Text>
            </TouchableOpacity>
          ))}

          {ingredients.length > 0 && (
            <>
              <Text style={[st.label, { marginTop: 16 }]}>INGREDIENTS ADDED</Text>
              {ingredients.map((ing, i) => (
                <View key={i} style={st.ingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }} numberOfLines={1}>{ing.name}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>
                      {Math.round(ing.calories * ing.qty / 100)} kcal · {ing.qty}g
                    </Text>
                  </View>
                  <TextInput
                    style={{ width: 60, borderWidth: 1, borderColor: mc.border, padding: 6, fontFamily: F.mono, fontSize: 12, color: mc.text, textAlign: 'center', marginRight: 8 }}
                    value={String(ing.qty)}
                    onChangeText={v => updateQty(i, v)}
                    keyboardType="decimal-pad"
                  />
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginRight: 8 }}>g</Text>
                  <TouchableOpacity onPress={() => removeIngredient(i)}>
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#E57373' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={st.macroRow}>
                {[['calories','KCAL'], ['protein','PROT'], ['carbs','CARBS'], ['fat','FAT']].map(([f, l]) => (
                  <View key={f} style={[st.macro, { flex: 1 }]}>
                    <Text style={[st.macroVal, { fontSize: 16 }]}>{perServing(f)}</Text>
                    <Text style={st.macroLbl}>{l}/SV</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={st.saveBtn} onPress={saveRecipe}>
                <Text style={st.saveTxt}>SAVE RECIPE</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={st.root}>
      <View style={st.content}>
        <Text style={st.title}>Recipe Builder</Text>
        <Text style={st.sub}>BUILD & SAVE CUSTOM RECIPES</Text>

        <TouchableOpacity style={st.saveBtn} onPress={() => { setName(''); setServings('1'); setIngredients([]); setSearchQ(''); setResults([]); setView('build'); }}>
          <Text style={st.saveTxt}>＋  NEW RECIPE</Text>
        </TouchableOpacity>

        {recipes.length === 0 ? (
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3, textAlign: 'center', marginTop: 40 }}>
            No recipes yet. Build your first one above.
          </Text>
        ) : (
          <View style={{ marginTop: 24 }}>
            {recipes.map(r => (
              <TouchableOpacity key={r.id} style={st.card} onPress={() => setDetail(r)}>
                <Text style={st.cardName}>{r.name}</Text>
                <Text style={st.cardSub}>
                  {r.servings} serving{r.servings > 1 ? 's' : ''} · {r.calPerSv} kcal/sv · {r.ingredients?.length} ingredients
                </Text>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 4 }}>
                  P: {r.protPerSv}g · C: {r.carbsPerSv}g · F: {r.fatPerSv}g per serving
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
