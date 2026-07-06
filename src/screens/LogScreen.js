import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Modal, ActivityIndicator, Platform, Image,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { C, F } from '../theme';
import { useTheme } from '../ThemeContext';
import { aiChat, fetchLogs, syncLogs, awardXP, lookupBarcode, searchFood, foodPhotoExtract } from '../api';
import BarcodeScanner from '../components/BarcodeScanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, getUser } from '../auth';
import { DonutChart } from '../components/Charts';

// ─── helpers ───────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10); }

function dateLabel() {
  const iso = today();
  const d = new Date(iso + 'T00:00');
  return d.toLocaleDateString('en', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).toUpperCase();
}

const MICRO_KEYS = ['fiber', 'sugar', 'sodium', 'vitA', 'vitC', 'vitD', 'vitB12', 'iron', 'calcium', 'potassium', 'magnesium', 'zinc'];
function pickMicros(item) {
  const out = {};
  MICRO_KEYS.forEach(k => { if (item[k]) out[k] = item[k]; });
  return Object.keys(out).length ? out : null;
}

function emptyEntry() {
  return {
    date: today(), weight: '', steps: '', workout: '',
    hunger: 5, energy: 5, foods: [],
    calories: 0, protein: 0, carbs: 0, fat: 0,
    water: 0, sleep_hours: '', sleep_quality: 5,
  };
}

// ─── Indian food quick-add database ─────────────────────────────────────────
const INDIAN_FOODS = [
  { name: 'Roti (wheat)',        calories: 71,  protein: 2.7, carbs: 15,  fat: 0.4, serving: '1 piece 30g' },
  { name: 'Rice (cooked)',       calories: 130, protein: 2.7, carbs: 28,  fat: 0.3, serving: '100g' },
  { name: 'Dal Tadka',           calories: 148, protein: 9,   carbs: 20,  fat: 3,   serving: '100g' },
  { name: 'Idli',                calories: 39,  protein: 2,   carbs: 8,   fat: 0.2, serving: '1 piece 30g' },
  { name: 'Dosa',                calories: 133, protein: 3.5, carbs: 25,  fat: 2.7, serving: '1 medium 70g' },
  { name: 'Sambar',              calories: 50,  protein: 3,   carbs: 8,   fat: 1,   serving: '100g' },
  { name: 'Palak Paneer',        calories: 165, protein: 9,   carbs: 6,   fat: 12,  serving: '100g' },
  { name: 'Chicken Curry',       calories: 165, protein: 20,  carbs: 4,   fat: 8,   serving: '100g' },
  { name: 'Paneer Butter Masala',calories: 193, protein: 10,  carbs: 8,   fat: 14,  serving: '100g' },
  { name: 'Biryani (chicken)',   calories: 200, protein: 12,  carbs: 25,  fat: 6,   serving: '100g' },
  { name: 'Curd / Dahi',         calories: 61,  protein: 3.1, carbs: 4.7, fat: 3.3, serving: '100g' },
  { name: 'Poha',                calories: 76,  protein: 1.5, carbs: 16,  fat: 0.3, serving: '100g' },
  { name: 'Upma',                calories: 90,  protein: 2.4, carbs: 15,  fat: 2.5, serving: '100g' },
  { name: 'Paratha (plain)',     calories: 170, protein: 3.5, carbs: 26,  fat: 6,   serving: '1 piece 60g' },
  { name: 'Aloo Paratha',        calories: 200, protein: 4,   carbs: 30,  fat: 7,   serving: '1 piece 75g' },
  { name: 'Rajma',               calories: 144, protein: 9,   carbs: 24,  fat: 0.5, serving: '100g' },
  { name: 'Chana Masala',        calories: 164, protein: 9,   carbs: 27,  fat: 3,   serving: '100g' },
  { name: 'Egg (boiled)',        calories: 78,  protein: 6,   carbs: 0.6, fat: 5,   serving: '1 egg 50g' },
  { name: 'Moong Dal',           calories: 105, protein: 7,   carbs: 18,  fat: 0.4, serving: '100g' },
  { name: 'Puri',                calories: 150, protein: 2.5, carbs: 18,  fat: 8,   serving: '1 piece 30g' },
  { name: 'Uttapam',             calories: 107, protein: 3,   carbs: 18,  fat: 2.5, serving: '1 medium 80g' },
  { name: 'Khichdi',             calories: 97,  protein: 4,   carbs: 18,  fat: 1.5, serving: '100g' },
  { name: 'Bhindi Masala',       calories: 65,  protein: 2,   carbs: 8,   fat: 3,   serving: '100g' },
  { name: 'Aloo Sabzi',          calories: 95,  protein: 1.8, carbs: 16,  fat: 3,   serving: '100g' },
  { name: 'Chai (with milk)',    calories: 30,  protein: 1.5, carbs: 4,   fat: 1,   serving: '1 cup 150ml' },
  { name: 'Lassi (sweet)',       calories: 78,  protein: 3,   carbs: 12,  fat: 2,   serving: '200ml' },
];

// ─── Alcoholic drinks quick-add — alcohol in grams (7 kcal/g) ──────────────
const DRINKS = [
  { name: 'Beer (regular, 330ml)',     calories: 150, protein: 1.6, carbs: 13, fat: 0, alcohol: 14, serving: '330ml can' },
  { name: 'Beer (light, 330ml)',       calories: 103, protein: 0.9, carbs: 6,  fat: 0, alcohol: 11, serving: '330ml can' },
  { name: 'Wine (red, 150ml)',         calories: 125, protein: 0.1, carbs: 4,  fat: 0, alcohol: 15, serving: '150ml glass' },
  { name: 'Wine (white, 150ml)',       calories: 121, protein: 0.1, carbs: 3.8,fat: 0, alcohol: 15, serving: '150ml glass' },
  { name: 'Whiskey / Vodka (shot)',    calories: 97,  protein: 0,   carbs: 0,  fat: 0, alcohol: 14, serving: '44ml shot' },
  { name: 'Rum (shot)',                calories: 97,  protein: 0,   carbs: 0,  fat: 0, alcohol: 14, serving: '44ml shot' },
  { name: 'Gin & Tonic',               calories: 150, protein: 0,   carbs: 8,  fat: 0, alcohol: 14, serving: '1 drink' },
  { name: 'Champagne / Sparkling',     calories: 96,  protein: 0.2, carbs: 2,  fat: 0, alcohol: 12, serving: '120ml glass' },
  { name: 'Cocktail (sweet, avg)',     calories: 220, protein: 0,   carbs: 22, fat: 0, alcohol: 18, serving: '1 drink' },
];

const MEAL_TAGS = [
  { key: 'on_plan', label: 'On Plan', color: '#4CAF7C' },
  { key: 'treat',   label: 'Treat',   color: '#DAA520' },
  { key: 'stress',  label: 'Stress',  color: '#E57373' },
  { key: 'mindful', label: 'Mindful', color: '#7C8BF5' },
];

const MINDFUL_OPTS = [
  { key: 'great',    emoji: '', label: 'Great',    sub: 'Felt good about my choices' },
  { key: 'ok',       emoji: '', label: 'OK',       sub: 'Pretty normal day' },
  { key: 'struggle', emoji: '', label: 'Struggled', sub: 'Hard day with food' },
  { key: 'offplan',  emoji: '', label: 'Off plan',  sub: 'Didn\'t follow my plan' },
];

// ─── Mic SVG icon (matches HTML exactly) ───────────────────────────────────
function MicSvg({ color = '#554430' }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Line x1="12" y1="19" x2="12" y2="23" />
      <Line x1="8" y1="23" x2="16" y2="23" />
    </Svg>
  );
}

// ─── Checkmark SVG (done state) ────────────────────────────────────────────
function CheckSvg() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="#4CAF7C" strokeWidth={2.5} strokeLinecap="round">
      <Path d="M20 6 9 17 4 12" />
    </Svg>
  );
}

// ─── Plus SVG (add food button) ────────────────────────────────────────────
function PlusSvg({ color = C.text2 }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

// ─── WebSlider — native <input type="range"> on web, segmented dots on native
function WebSlider({ min, max, value, onChange, accentColor: accent = C.gold, borderColor = C.border }) {
  if (Platform.OS === 'web') {
    return (
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          height: 2,
          cursor: 'pointer',
          accentColor: accent,
          background: borderColor,
          outline: 'none',
          WebkitAppearance: 'none',
          appearance: 'none',
        }}
      />
    );
  }
  // Fallback: tap-to-set dots for native (non-critical)
  const dots = [];
  for (let i = min; i <= max; i++) {
    dots.push(
      <TouchableOpacity key={i} onPress={() => onChange(i)}
        style={[st.sliderDot, i <= value && st.sliderDotActive]} />
    );
  }
  return <View style={st.sliderTrack}>{dots}</View>;
}

// ═══════════════════════════════════════════════════════════════════════════
export default function LogScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  const [logKey,      setLogKey]      = useState('');
  const [logUser,     setLogUser]     = useState('');
  const [fastToast,   setFastToast]   = useState('');
  const [calorieTarget, setCalorieTarget] = useState(null);
  const fastToastTimer = useRef(null);
  const [entry,       setEntry]       = useState(null);
  const [saved,       setSaved]       = useState(false);
  const [hunger,      setHunger]      = useState(5);
  const [energy,      setEnergy]      = useState(5);

  // Add-food modal
  const [showFood,    setShowFood]    = useState(false);
  const [afView,      setAfView]      = useState('search'); // 'search' | 'manual'
  const [afName,      setAfName]      = useState('');
  const [afCal,       setAfCal]       = useState('');
  const [afServing,   setAfServing]   = useState('');
  const [afProtein,   setAfProtein]   = useState('');
  const [afCarbs,     setAfCarbs]     = useState('');
  const [afMicros,    setAfMicros]    = useState(null);
  const [afAlcohol,   setAfAlcohol]   = useState('');
  const [afSearchQ,   setAfSearchQ]   = useState('');
  const [afResults,   setAfResults]   = useState([]);
  const [afSearching, setAfSearching] = useState(false);
  const searchTimer = useRef(null);

  // Barcode scanner
  const [showScanner,   setShowScanner]   = useState(false);
  const [scanLoading,   setScanLoading]   = useState(false);

  // Meal templates
  const [templates,     setTemplates]     = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [tmplName,      setTmplName]      = useState('');
  const [showSaveTmpl,  setShowSaveTmpl]  = useState(false);

  // Ate-style features
  const [afTag,          setAfTag]          = useState(null);          // tag for food being added
  const [showMindful,    setShowMindful]    = useState(false);         // mindfulness check-in after save
  const [mindfulRating,  setMindfulRating]  = useState(null);
  const photoInputRef  = useRef(null);
  const [pendingPhotoIdx, setPendingPhotoIdx] = useState(null);

  // AI photo food recognition
  const aiPhotoInputRef = useRef(null);
  const [aiPhotoLoading, setAiPhotoLoading] = useState(false);
  const [aiPhotoError,   setAiPhotoError]   = useState('');
  const [aiPhotoFoods,   setAiPhotoFoods]   = useState([]);
  const [aiPhotoAdded,   setAiPhotoAdded]   = useState([]);

  // AI assistant
  const [asstOpen,    setAsstOpen]    = useState(true);
  const [asstMsgs,    setAsstMsgs]    = useState([{
    role: 'ai',
    text: "Hi! Tell me what you ate today, your weight, steps, or how you feel — I'll fill in your log. You can type or tap the mic to speak.",
  }]);
  const [asstInp,     setAsstInp]     = useState('');
  const [asstLoading, setAsstLoading] = useState(false);
  const [asstMicOn,   setAsstMicOn]   = useState(false);
  const [asstHistory, setAsstHistory] = useState([]);
  const asstMicRef   = useRef(null);
  const asstScrollRef = useRef(null);
  const asstInpRef   = useRef(null);

  // ── Load on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    getUser().then(async u => {
      setLogUser(u);
      const key = `toogood_daily_logs_${u}`;
      setLogKey(key);
      loadEntry(key);
      const raw = await AsyncStorage.getItem(`toogood_meal_templates_${u}`);
      if (raw) setTemplates(JSON.parse(raw));
      // Load SmartTargets computed targets for progress display
      const tRaw = await AsyncStorage.getItem(`tg_computed_targets_${u}`);
      if (tRaw) setCalorieTarget(JSON.parse(tRaw));
    });
  }, []);

  async function loadEntry(key) {
    const iso = today();
    let raw  = await AsyncStorage.getItem(key);
    let logs = raw ? JSON.parse(raw) : [];
    // Cross-device sync
    try {
      const d = await fetchLogs();
      if (d?.ok && d.logs?.length) {
        const serverMap = {};
        d.logs.forEach(l => { serverMap[l.date] = l; });
        const localMap = {};
        logs.forEach(l => { localMap[l.date] = l; });
        const merged = Object.values({ ...serverMap, ...localMap });
        merged.sort((a, b) => b.date.localeCompare(a.date));
        await AsyncStorage.setItem(key, JSON.stringify(merged));
        logs = merged;
      }
    } catch {}
    const ex = logs.find(l => l.date === iso);
    if (ex) {
      setEntry(ex);
      setHunger(ex.hunger || 5);
      setEnergy(ex.energy || 5);
      setSaved(!!(ex.calories > 0 || ex.weight || ex.workout));
    } else {
      setEntry(emptyEntry());
    }
  }

  async function persist(e) {
    if (!logKey) return;
    const raw  = await AsyncStorage.getItem(logKey);
    const logs = raw ? JSON.parse(raw) : [];
    const idx  = logs.findIndex(l => l.date === e.date);
    if (idx >= 0) logs[idx] = e; else logs.unshift(e);
    await AsyncStorage.setItem(logKey, JSON.stringify(logs));
    syncLogs([e]).catch(() => {});
  }

  // ── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!entry) return;
    const updated = {
      ...entry,
      hunger,
      energy,
      calories: (entry.foods || []).reduce((s, f) => s + (f.calories || 0), 0),
      protein:  (entry.foods || []).reduce((s, f) => s + (f.protein  || 0), 0),
      carbs:    (entry.foods || []).reduce((s, f) => s + (f.carbs    || 0), 0),
      fat:      (entry.foods || []).reduce((s, f) => s + (f.fat      || 0), 0),
    };
    await persist(updated);
    setEntry(updated);
    if (updated.workout?.trim()) awardXP('exercise').catch(() => {});
    setSaved(true);
    setMindfulRating(null);
    setShowMindful(true);
  }

  // ── Clear ───────────────────────────────────────────────────────────────
  async function handleClear() {
    if (!logKey) return;
    const raw  = await AsyncStorage.getItem(logKey);
    const logs = (raw ? JSON.parse(raw) : []).filter(l => l.date !== today());
    await AsyncStorage.setItem(logKey, JSON.stringify(logs));
    const fresh = emptyEntry();
    setEntry(fresh);
    setHunger(5);
    setEnergy(5);
    setSaved(false);
  }

  // ── Done-state subtitle ─────────────────────────────────────────────────
  function doneSub() {
    if (!entry) return '';
    const parts = [];
    if (entry.calories) parts.push(`${entry.calories} kcal`);
    if (entry.weight)   parts.push(`${entry.weight} kg`);
    if (entry.workout)  parts.push(entry.workout);
    return parts.join(' · ');
  }

  function doneStats() {
    if (!entry) return [];
    const items = [];
    if (entry.calories) items.push({ v: `${entry.calories}`, l: 'kcal' });
    if (entry.protein)  items.push({ v: `${entry.protein}g`, l: 'protein' });
    if (entry.weight)   items.push({ v: `${entry.weight}`, l: 'kg' });
    if (entry.steps)    items.push({ v: Number(entry.steps).toLocaleString(), l: 'steps' });
    return items;
  }

  // ── Food helpers ─────────────────────────────────────────────────────────
  const totalCal  = (entry?.foods || []).reduce((s, f) => s + (f.calories || 0), 0);
  const totalProt = (entry?.foods || []).reduce((s, f) => s + (f.protein || 0), 0);
  const totalCarb = (entry?.foods || []).reduce((s, f) => s + (f.carbs   || 0), 0);
  const totalFat  = (entry?.foods || []).reduce((s, f) => s + (f.fat     || 0), 0);

  function openAddFood() {
    setAfView('search');
    setAfSearchQ(''); setAfResults([]); setAfSearching(false);
    setAfName(''); setAfCal(''); setAfServing('');
    setAfProtein(''); setAfCarbs(''); setAfTag(null);
    setAfMicros(null); setAfAlcohol('');
    setShowFood(true);
  }

  function capturePhotoForFood(idx) {
    if (Platform.OS !== 'web') return;
    setPendingPhotoIdx(idx);
    photoInputRef.current?.click();
  }

  function openPhotoRecognition() {
    if (Platform.OS !== 'web') return;
    setAiPhotoError(''); setAiPhotoFoods([]); setAiPhotoAdded([]);
    setAfView('photo');
    setShowFood(true);
    aiPhotoInputRef.current?.click();
  }

  function handleAiPhotoCapture(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAiPhotoLoading(true);
    setAiPhotoError('');
    const reader = new FileReader();
    reader.onload = async ev => {
      const dataUrl = ev.target.result;
      const [, mime, b64] = dataUrl.match(/^data:(.+);base64,(.+)$/) || [];
      try {
        const d = await foodPhotoExtract({ image_b64: b64, image_mime: mime || file.type || 'image/jpeg' });
        if (d?.ok && d.foods?.length) {
          setAiPhotoFoods(d.foods);
        } else {
          setAiPhotoError(d?.error || "Couldn't identify any food in that photo — try a clearer shot or add it manually.");
        }
      } catch {
        setAiPhotoError('Could not reach the image analysis service.');
      }
      setAiPhotoLoading(false);
    };
    reader.readAsDataURL(file);
  }

  function addDetectedFood(item, idx) {
    const food = { name: item.name, serving: item.serving, calories: item.calories || 0, protein: item.protein || 0, carbs: item.carbs || 0, fat: item.fat || 0, tag: null, photo: null };
    setEntry(e => {
      const foods = [...(e.foods || []), food];
      return {
        ...e, foods,
        calories: foods.reduce((s, f) => s + (f.calories || 0), 0),
        protein:  foods.reduce((s, f) => s + (f.protein  || 0), 0),
        carbs:    foods.reduce((s, f) => s + (f.carbs    || 0), 0),
      };
    });
    awardXP('food_log').catch(() => {});
    setAiPhotoAdded(a => [...a, idx]);
  }

  function handlePhotoCapture(e) {
    const file = e.target.files?.[0];
    if (!file || pendingPhotoIdx === null) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      setEntry(ent => {
        const foods = (ent.foods || []).map((f, i) =>
          i === pendingPhotoIdx ? { ...f, photo: dataUrl } : f
        );
        return { ...ent, foods };
      });
      setPendingPhotoIdx(null);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  }

  function onSearchChange(q) {
    setAfSearchQ(q);
    setAfResults([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setAfSearching(false); return; }
    setAfSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchFood(q);
        setAfResults(results);
      } catch {}
      setAfSearching(false);
    }, 450);
  }

  function selectFoodResult(item) {
    setAfName(item.brand ? `${item.name} (${item.brand})` : item.name);
    setAfCal(String(item.calories));
    setAfServing(item.serving);
    setAfProtein(String(item.protein));
    setAfCarbs(String(item.carbs));
    setAfMicros(pickMicros(item));
    setAfAlcohol(item.alcohol ? String(item.alcohol) : '');
    setAfView('manual');
  }

  async function saveTemplate() {
    if (!tmplName.trim() || !(entry?.foods?.length)) return;
    const u = await getUser();
    const key = `toogood_meal_templates_${u}`;
    const t = { id: Date.now(), name: tmplName.trim(), foods: entry.foods };
    const updated = [...templates, t];
    setTemplates(updated);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    setShowSaveTmpl(false);
    setTmplName('');
  }

  async function deleteTemplate(id) {
    const u = await getUser();
    const key = `toogood_meal_templates_${u}`;
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  }

  function applyTemplate(t) {
    setEntry(e => {
      const foods = [...(e.foods || []), ...t.foods];
      return {
        ...e, foods,
        calories: foods.reduce((s, f) => s + (f.calories || 0), 0),
        protein:  foods.reduce((s, f) => s + (f.protein  || 0), 0),
        carbs:    foods.reduce((s, f) => s + (f.carbs    || 0), 0),
      };
    });
    setShowTemplates(false);
  }

  async function handleScanned(code) {
    setShowScanner(false);
    setScanLoading(true);
    try {
      const p = await lookupBarcode(code);
      setAfName(p.brand ? `${p.name} (${p.brand})` : p.name);
      setAfCal(String(p.calories));
      setAfServing(p.serving);
      setAfProtein(String(p.protein));
      setAfCarbs(String(p.carbs));
      setAfMicros(pickMicros(p));
      setShowFood(true);
    } catch {
      setAfName(''); setAfCal(''); setAfServing(''); setAfProtein(''); setAfCarbs(''); setAfMicros(null);
      setShowFood(true);
    } finally {
      setScanLoading(false);
    }
  }

  function flashFastToast(text) {
    setFastToast(text);
    clearTimeout(fastToastTimer.current);
    fastToastTimer.current = setTimeout(() => setFastToast(''), 3500);
  }

  async function checkFastingOnLog() {
    if (!logUser) return;
    const raw = await AsyncStorage.getItem(`tg_fasting_${logUser}`);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (!d.fastStart || !d.protocol) return;
    const now = Date.now();
    const eatStart = d.fastStart + d.protocol.fast * 3600000;
    const eatEnd   = d.fastStart + (d.protocol.fast + d.protocol.eat) * 3600000;
    if (now < eatStart) {
      // Food logged during the fasting window — auto-end the fast early
      const updated = {
        ...d,
        fastStart: null,
        history: [...(d.history || []), { start: d.fastStart, end: now, duration: now - d.fastStart, protocol: d.protocol, endedEarly: true }],
      };
      await AsyncStorage.setItem(`tg_fasting_${logUser}`, JSON.stringify(updated));
      flashFastToast('Fast ended early — fasting record auto-updated');
    } else if (now > eatEnd) {
      flashFastToast('You\'re logging outside your eating window — consider updating your fasting schedule');
    }
  }

  function quickAddFood(food) {
    const item = { name: food.name, serving: food.serving, calories: food.calories, protein: food.protein || 0, carbs: food.carbs || 0, fat: food.fat || 0, tag: null, photo: null };
    setEntry(e => {
      const foods = [...(e.foods || []), item];
      return { ...e, foods, calories: foods.reduce((s, f) => s + (f.calories || 0), 0), protein: foods.reduce((s, f) => s + (f.protein || 0), 0), carbs: foods.reduce((s, f) => s + (f.carbs || 0), 0) };
    });
    awardXP('food_log').catch(() => {});
    checkFastingOnLog();
  }

  function submitAddFood() {
    const name = afName.trim();
    if (!name) return;
    const food = {
      name,
      serving:  afServing.trim(),
      calories: parseInt(afCal)      || 0,
      protein:  parseFloat(afProtein) || 0,
      carbs:    parseFloat(afCarbs)   || 0,
      fat:      0,
      tag:      afTag,
      photo:    null,
      ...(afMicros || {}),
      ...(parseFloat(afAlcohol) > 0 ? { alcohol: parseFloat(afAlcohol) } : {}),
    };
    setEntry(e => {
      const foods = [...(e.foods || []), food];
      return {
        ...e,
        foods,
        calories: foods.reduce((s, f) => s + (f.calories || 0), 0),
        protein:  foods.reduce((s, f) => s + (f.protein  || 0), 0),
        carbs:    foods.reduce((s, f) => s + (f.carbs    || 0), 0),
      };
    });
    awardXP('food_log').catch(() => {});
    checkFastingOnLog();
    setAfTag(null);
    setAfMicros(null);
    setAfAlcohol('');
    setShowFood(false);
  }

  function deleteFood(idx) {
    setEntry(e => {
      const foods = (e.foods || []).filter((_, j) => j !== idx);
      return {
        ...e,
        foods,
        calories: foods.reduce((s, f) => s + (f.calories || 0), 0),
        protein:  foods.reduce((s, f) => s + (f.protein  || 0), 0),
        carbs:    foods.reduce((s, f) => s + (f.carbs    || 0), 0),
      };
    });
  }

  // ── AI assistant ────────────────────────────────────────────────────────
  function asstToggleMic() {
    if (Platform.OS !== 'web') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (asstMicOn) {
      try { asstMicRef.current?.stop(); } catch {}
      asstMicRef.current = null;
      setAsstMicOn(false);
      return;
    }
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';
    let final = '';
    r.onresult = ev => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) final += ev.results[i][0].transcript + ' ';
        else interim = ev.results[i][0].transcript;
      }
      setAsstInp((final + interim).trim());
    };
    r.onerror = () => { setAsstMicOn(false); asstMicRef.current = null; };
    r.onend   = () => { if (asstMicRef.current) r.start(); };
    asstMicRef.current = r;
    r.start();
    setAsstMicOn(true);
  }

  async function asstSend() {
    const msg = asstInp.trim();
    if (!msg || asstLoading) return;
    if (asstMicOn) {
      try { asstMicRef.current?.stop(); } catch {}
      asstMicRef.current = null;
      setAsstMicOn(false);
    }
    setAsstInp('');
    const newHistory = [...asstHistory, { role: 'user', content: msg }];
    setAsstMsgs(m => [...m, { role: 'user', text: msg }]);
    setAsstLoading(true);
    try {
      const d = await aiChat(msg, asstHistory);
      const reply = d.reply || 'Got it!';
      setAsstMsgs(m => [...m, { role: 'ai', text: reply }]);
      setAsstHistory([...newHistory, { role: 'assistant', content: reply }]);
      if (d.logged) asstApplyLogged(d.logged);
    } catch {
      setAsstMsgs(m => [...m, { role: 'ai', text: 'Network error — check your connection and try again.' }]);
    }
    setAsstLoading(false);
    setTimeout(() => asstScrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  function asstApplyLogged(logged) {
    setEntry(e => {
      if (!e) return e;
      const upd = { ...e };
      if (logged.weight       != null) upd.weight        = String(logged.weight);
      if (logged.steps        != null) upd.steps         = String(logged.steps);
      if (logged.workout)              upd.workout        = logged.workout;
      if (logged.hunger       != null) setHunger(logged.hunger);
      if (logged.energy       != null) setEnergy(logged.energy);
      if (logged.sleep_hours  != null) upd.sleep_hours   = String(logged.sleep_hours);
      if (logged.sleep_quality!= null) upd.sleep_quality = logged.sleep_quality;
      if (logged.water        != null) upd.water         = logged.water;
      if (logged.foods?.length) {
        const existing = new Set((upd.foods || []).map(f => f.name.toLowerCase().trim()));
        const VALID_MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
        const toAdd = (logged.foods || []).filter(
          f => !existing.has((f.name || '').toLowerCase().trim())
        ).map(f => ({
          name: f.name || '', serving: f.serving || '',
          calories: f.calories || 0, protein: f.protein || 0,
          carbs: f.carbs || 0, fat: f.fat || 0,
          meal: VALID_MEALS.has(f.meal) ? f.meal : null,
        }));
        const foods = [...(upd.foods || []), ...toAdd];
        upd.foods    = foods;
        upd.calories = foods.reduce((s, f) => s + (f.calories || 0), 0);
        upd.protein  = foods.reduce((s, f) => s + (f.protein  || 0), 0);
        upd.carbs    = foods.reduce((s, f) => s + (f.carbs    || 0), 0);
      }
      return upd;
    });
    setSaved(false);
  }

  // ── Styles (reactive to theme) ───────────────────────────────────────────
  const st = StyleSheet.create({
    screen:       { flex: 1, backgroundColor: mc.bg },
    scrollContent:{ paddingBottom: 60 },

    // ── Page header
    pageHeader:   { paddingHorizontal: 48, paddingTop: 40, marginBottom: 32 },
    pageTitle:    { fontFamily: F.display, fontSize: 26, color: mc.text, letterSpacing: 1, marginBottom: 6 },
    pageSub:      { fontSize: fontSize, color: mc.text3, letterSpacing: 1, fontFamily: F.mono },

    // ── AI Assistant panel — .asst-panel
    asstPanel:    { marginHorizontal: 48, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, marginBottom: 20 },
    asstHeader:   { paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: mc.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    asstTitle:    { fontFamily: F.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: accentColor },
    asstToggle:   { fontFamily: F.mono, fontSize: 11, color: mc.text3, letterSpacing: 1 },

    // Messages — .asst-msgs
    asstMsgs:     { paddingVertical: 14, paddingHorizontal: 18, minHeight: 44, maxHeight: 200 },
    asstMsg:      { maxWidth: '88%', marginBottom: 10 },
    asstMsgUser:  { alignSelf: 'flex-end' },
    asstMsgAi:    { alignSelf: 'flex-start' },
    asstBubble:   { paddingVertical: 8, paddingHorizontal: 12 },
    asstBubbleUser: { backgroundColor: mc.goldDim, borderWidth: 1, borderColor: 'rgba(201,168,76,0.18)' },
    asstBubbleAi:   { backgroundColor: mc.elevated, borderWidth: 1, borderColor: mc.border },
    asstBubbleTxt:  { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), lineHeight: 20, color: mc.text2 },
    asstBubbleTxtUser: { color: mc.text },

    // Hint — .asst-hint
    asstHint:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, paddingHorizontal: 18, paddingBottom: 8, letterSpacing: 1 },

    // Input row — .asst-input-row
    asstInputRow: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 10, paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: mc.border, gap: 8 },

    // Mic button — .asst-mic
    asstMicBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: mc.border, paddingVertical: 8, paddingHorizontal: 12, flexShrink: 0 },
    asstMicBtnRecording:{ borderColor: accentColor },
    asstMicTxt:         { fontFamily: F.mono, fontSize: 11, color: mc.text3, letterSpacing: 1 },

    // Text input — .asst-inp
    asstInp:      { flex: 1, backgroundColor: mc.elevated, borderWidth: 1, borderColor: mc.border, color: mc.text, fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), paddingVertical: 8, paddingHorizontal: 12, outlineWidth: 0 },

    // Send button — .asst-send
    asstSendBtn:        { backgroundColor: accentColor, paddingVertical: 8, paddingHorizontal: 18, justifyContent: 'center', flexShrink: 0 },
    asstSendBtnDisabled:{ opacity: 0.45 },
    asstSendTxt:        { fontFamily: F.mono, fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#060606' },

    // ── Log card — .log-card
    logCard:      { marginHorizontal: 48, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, padding: 28, paddingHorizontal: 32, marginBottom: 24 },
    logDate:      { fontSize: 11, color: mc.text3, letterSpacing: 5, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 20 },

    // Form fields — .log-row / .log-field / .log-label / .log-input
    logRow:       { flexDirection: 'row', gap: 20, marginBottom: 20 },
    logField:     { flex: 1, gap: 6 },
    logLabel:     { fontSize: 10, color: mc.text3, letterSpacing: 5, textTransform: 'uppercase', fontFamily: F.mono },
    logInput:     { backgroundColor: mc.elevated, borderBottomWidth: 1, borderBottomColor: mc.border, color: mc.text, fontFamily: F.mono, fontSize: fontSize, paddingVertical: 7, paddingHorizontal: 0, letterSpacing: 1, outlineWidth: 0 },
    logWorkout:   { marginBottom: 20, gap: 6 },

    // Sliders — .slider-row / .slider-field / .slider-top / .slider-val
    sliderRow:       { flexDirection: 'row', gap: 20, marginBottom: 24 },
    sliderField:     { flex: 1, gap: 8 },
    sliderTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sliderVal:       { fontFamily: F.display, fontSize: 16, color: accentColor },
    sliderTrack:     { flexDirection: 'row', gap: 3, alignItems: 'center', marginTop: 4 },
    sliderDot:       { flex: 1, height: 3, backgroundColor: mc.border },
    sliderDotActive: { backgroundColor: accentColor },

    // Food log header — .food-log-header
    foodLogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderTopWidth: 1, borderTopColor: mc.border, paddingTop: 20 },
    foodLogTitle:  { fontSize: 11, color: mc.text3, letterSpacing: 5, textTransform: 'uppercase', fontFamily: F.mono },
    foodCalTotal:  { fontFamily: F.display, fontSize: 16, color: accentColor },

    // Food items — .food-items / .food-item / .no-food
    foodItems:     { minHeight: 32, marginBottom: 14 },
    foodItem:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.06)' },
    foodItemName:  { flex: 1, fontSize: fontSize, color: mc.text, fontFamily: F.mono },
    foodItemCal:   { color: accentColor, fontFamily: F.display, fontSize: fontSize, minWidth: 60, textAlign: 'right' },
    foodItemMacro: { color: mc.text3, fontSize: 11, fontFamily: F.mono, minWidth: 60, textAlign: 'right' },
    foodItemDel:   { color: mc.text3, fontSize: fontSize, paddingVertical: 2, paddingHorizontal: 4 },
    noFood:        { fontSize: Math.max(10, fontSize - 2), color: mc.text3, fontStyle: 'italic', paddingVertical: 4, fontFamily: F.mono },

    // Food actions — .food-actions / .food-btn
    foodActions:   { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    foodBtn:       { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: mc.border },
    foodBtnTxt:    { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), letterSpacing: 2, color: mc.text2 },

    // Log footer — .log-footer / .log-save-btn / .log-clear-btn
    logFooter:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
    logSaveBtn:   { paddingVertical: 10, paddingHorizontal: 28, backgroundColor: accentColor },
    logSaveTxt:   { color: '#060606', fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), letterSpacing: 3, textTransform: 'uppercase', fontWeight: '700' },
    logClearBtn:  { paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(207,102,121,0.3)' },
    logClearTxt:  { color: C.red, fontFamily: F.mono, fontSize: 11, letterSpacing: 2 },

    // Done state — .log-done-state / .log-done-banner / .log-done-check
    doneBanner:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: mc.border, marginBottom: 18 },
    doneCheck:    { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(76,175,124,0.15)', borderWidth: 1, borderColor: 'rgba(76,175,124,0.4)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    doneLabel:    { fontSize: fontSize, color: mc.text, letterSpacing: 1, fontFamily: F.mono },
    doneSub:      { fontSize: 11, color: mc.text3, marginTop: 2, letterSpacing: 2, fontFamily: F.mono },
    doneStats:    { flexDirection: 'row', gap: 24, flexWrap: 'wrap', paddingVertical: 12 },
    doneStat:     { gap: 3 },
    doneStatVal:  { fontSize: 16, color: accentColor, letterSpacing: 1, fontFamily: F.mono },
    doneStatLbl:  { fontSize: 10, color: mc.text3, letterSpacing: 4, textTransform: 'uppercase', fontFamily: F.mono },
    doneActions:  { flexDirection: 'row', gap: 10, marginTop: 16 },
    logEditBtn:   { paddingVertical: 8, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(192,80,80,0.3)' },
    logEditTxt:   { color: '#C05050', fontFamily: F.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },

    // Add food modal — .modal-backdrop / .modal-box
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center' },
    modalBox:      { backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, borderRadius: borderRadius, padding: 22, width: 400, maxWidth: '92%', gap: 14 },
    modalTitle:    { fontFamily: F.display, fontSize: 15, color: mc.text, letterSpacing: 1 },
    modalField:    { gap: 5 },
    modalLabel:    { fontSize: 10, color: mc.text3, letterSpacing: 4, textTransform: 'uppercase', fontFamily: F.mono },
    modalInput:    { backgroundColor: mc.bg, borderWidth: 1, borderColor: mc.border, color: mc.text, fontFamily: F.mono, fontSize: fontSize, paddingVertical: 9, paddingHorizontal: 10, outlineWidth: 0 },
    modalRow:      { flexDirection: 'row', gap: 12 },
    modalActions:  { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', paddingTop: 4 },
    modalCancel:   { borderWidth: 1, borderColor: mc.border, paddingVertical: 8, paddingHorizontal: 16 },
    modalCancelTxt:{ fontFamily: F.mono, fontSize: 11, color: mc.text2, letterSpacing: 2 },
    modalOk:       { backgroundColor: accentColor, paddingVertical: 8, paddingHorizontal: 20 },
    modalOkTxt:    { fontFamily: F.mono, fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#060606' },
  });

  // ── Loading guard ────────────────────────────────────────────────────────
  if (!entry) return <View style={st.screen} />;

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={st.screen} contentContainerStyle={st.scrollContent}>

      {/* ── Page header — .page-header ── */}
      <View style={st.pageHeader}>
        <Text style={st.pageTitle}>Log Today</Text>
        <Text style={st.pageSub}>Track your intake, activity and how you feel.</Text>
      </View>

      {/* ── AI Assistant Panel — .asst-panel ── */}
      <View style={st.asstPanel}>
        <View style={st.asstHeader}>
          <Text style={st.asstTitle}>AI Assistant — Log by voice or text</Text>
          <TouchableOpacity onPress={() => setAsstOpen(o => !o)}>
            <Text style={st.asstToggle}>{asstOpen ? 'hide ▴' : 'show ▾'}</Text>
          </TouchableOpacity>
        </View>

        {asstOpen && (
          <View>
            {/* Messages */}
            <ScrollView
              ref={asstScrollRef}
              style={st.asstMsgs}
              showsVerticalScrollIndicator={false}
            >
              {asstMsgs.map((m, i) => (
                <View key={i} style={[st.asstMsg, m.role === 'user' ? st.asstMsgUser : st.asstMsgAi]}>
                  <View style={[st.asstBubble, m.role === 'user' ? st.asstBubbleUser : st.asstBubbleAi]}>
                    <Text style={[st.asstBubbleTxt, m.role === 'user' && st.asstBubbleTxtUser]}>
                      {m.text}
                    </Text>
                  </View>
                </View>
              ))}
              {asstLoading && (
                <View style={st.asstMsgAi}>
                  <View style={st.asstBubbleAi}>
                    <Text style={[st.asstBubbleTxt, { fontStyle: 'italic', color: mc.text3 }]}>
                      Thinking...
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Hint */}
            <Text style={st.asstHint}>
              Tap mic and speak naturally, or type below. I'll update the form automatically.
            </Text>

            {/* Input row */}
            <View style={st.asstInputRow}>
              <TouchableOpacity
                style={[st.asstMicBtn, asstMicOn && st.asstMicBtnRecording]}
                onPress={asstToggleMic}
              >
                <MicSvg color={asstMicOn ? accentColor : mc.text3} />
                <Text style={[st.asstMicTxt, asstMicOn && { color: accentColor }]}>Mic</Text>
              </TouchableOpacity>

              <TextInput
                ref={asstInpRef}
                style={st.asstInp}
                value={asstInp}
                onChangeText={setAsstInp}
                placeholder="e.g. I had dal rice for lunch, walked 6000 steps, weigh 74 kg..."
                placeholderTextColor={mc.text3}
                onSubmitEditing={asstSend}
                returnKeyType="send"
              />

              <TouchableOpacity
                style={[st.asstSendBtn, (asstLoading || !asstInp.trim()) && st.asstSendBtnDisabled]}
                onPress={asstSend}
                disabled={asstLoading || !asstInp.trim()}
              >
                <Text style={st.asstSendTxt}>{asstLoading ? '...' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Log Card — .log-card ── */}
      <View style={st.logCard}>
        <Text style={st.logDate}>{dateLabel()}</Text>

        {saved ? (
          /* ── Done state — .log-done-state ── */
          <View>
            <View style={st.doneBanner}>
              <View style={st.doneCheck}>
                <CheckSvg />
              </View>
              <View>
                <Text style={st.doneLabel}>Already logged for today</Text>
                <Text style={st.doneSub}>{doneSub()}</Text>
              </View>
            </View>

            <View style={st.doneStats}>
              {doneStats().map((item, i) => (
                <View key={i} style={st.doneStat}>
                  <Text style={st.doneStatVal}>{item.v}</Text>
                  <Text style={st.doneStatLbl}>{item.l}</Text>
                </View>
              ))}
            </View>

            {/* Mindfulness summary */}
            {mindfulRating && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 4 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>
                  Today's eating: {MINDFUL_OPTS.find(o => o.key === mindfulRating)?.label}
                </Text>
                <TouchableOpacity onPress={() => setShowMindful(true)} style={{ marginLeft: 'auto' }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor }}>change</Text>
                </TouchableOpacity>
              </View>
            )}
            {!mindfulRating && (
              <TouchableOpacity onPress={() => setShowMindful(true)} style={{ marginTop: 10, paddingVertical: 8, borderWidth: 1, borderColor: mc.border, alignItems: 'center' }}>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>How did your eating feel today?</Text>
              </TouchableOpacity>
            )}

            {/* Photo timeline */}
            {(entry?.foods || []).some(f => f.photo) && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 8 }}>MEAL PHOTOS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {(entry.foods || []).filter(f => f.photo).map((f, i) => (
                    <View key={i} style={{ marginRight: 10, alignItems: 'center' }}>
                      <Image source={{ uri: f.photo }} style={{ width: 70, height: 70, borderRadius: 2 }} />
                      <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, marginTop: 4, maxWidth: 70 }} numberOfLines={1}>{f.name}</Text>
                      {f.tag && (
                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: MEAL_TAGS.find(t => t.key === f.tag)?.color || mc.text3 }}>
                          {MEAL_TAGS.find(t => t.key === f.tag)?.label}
                        </Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={st.doneActions}>
              <TouchableOpacity style={st.logEditBtn} onPress={handleClear}>
                <Text style={st.logEditTxt}>Clear and re-log</Text>
              </TouchableOpacity>
            </View>
          </View>

        ) : (
          /* ── Form state — #logFormState ── */
          <View>
            {/* Weight + Steps row */}
            <View style={st.logRow}>
              <View style={st.logField}>
                <Text style={st.logLabel}>Weight (kg)</Text>
                <TextInput
                  style={st.logInput}
                  value={entry.weight}
                  onChangeText={v => setEntry(e => ({ ...e, weight: v }))}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 74.5"
                  placeholderTextColor={mc.text3}
                />
              </View>
              <View style={st.logField}>
                <Text style={st.logLabel}>Steps</Text>
                <TextInput
                  style={st.logInput}
                  value={entry.steps}
                  onChangeText={v => setEntry(e => ({ ...e, steps: v }))}
                  keyboardType="number-pad"
                  placeholder="e.g. 8500"
                  placeholderTextColor={mc.text3}
                />
              </View>
            </View>

            {/* Workout — .log-workout (grid-column: 1 / -1) */}
            <View style={st.logWorkout}>
              <Text style={st.logLabel}>Workout / Activity</Text>
              <TextInput
                style={st.logInput}
                value={entry.workout}
                onChangeText={v => setEntry(e => ({ ...e, workout: v }))}
                placeholder="e.g. 30 min walk, yoga, rest day"
                placeholderTextColor={mc.text3}
              />
            </View>

            {/* Slider row — .slider-row */}
            <View style={st.sliderRow}>
              <View style={st.sliderField}>
                <View style={st.sliderTop}>
                  <Text style={st.logLabel}>Hunger level</Text>
                  <Text style={st.sliderVal}>{hunger}</Text>
                </View>
                <WebSlider min={1} max={10} value={hunger} onChange={setHunger} accentColor={accentColor} borderColor={mc.border} />
              </View>
              <View style={st.sliderField}>
                <View style={st.sliderTop}>
                  <Text style={st.logLabel}>Energy level</Text>
                  <Text style={st.sliderVal}>{energy}</Text>
                </View>
                <WebSlider min={1} max={10} value={energy} onChange={setEnergy} accentColor={accentColor} borderColor={mc.border} />
              </View>
            </View>

            {/* ── Water tracker ── */}
            <View style={[st.logRow, { marginTop: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: mc.border, paddingTop: 14 }]}>
              <View style={{ flex: 1 }}>
                <Text style={st.logLabel}>Water intake</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <TouchableOpacity onPress={() => setEntry(e => ({ ...e, water: Math.max(0, (e.water || 0) - 1) }))} style={{ width: 28, height: 28, borderWidth: 1, borderColor: mc.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: mc.text2, fontSize: 16, fontFamily: F.mono }}>−</Text>
                  </TouchableOpacity>
                  <Text style={{ fontFamily: F.serif, fontSize: 22, color: accentColor, minWidth: 30, textAlign: 'center' }}>{entry?.water || 0}</Text>
                  <TouchableOpacity onPress={() => setEntry(e => ({ ...e, water: (e.water || 0) + 1 }))} style={{ width: 28, height: 28, borderWidth: 1, borderColor: mc.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: mc.text2, fontSize: 16, fontFamily: F.mono }}>+</Text>
                  </TouchableOpacity>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>glasses  ·  goal: 8</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <View key={i} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: i < (entry?.water || 0) ? accentColor : mc.border }} />
                  ))}
                </View>
              </View>
              <View style={{ flex: 1, paddingLeft: 16 }}>
                <Text style={st.logLabel}>Sleep (hours)</Text>
                <TextInput
                  style={[st.logInput, { marginTop: 6 }]}
                  value={entry?.sleep_hours || ''}
                  onChangeText={v => setEntry(e => ({ ...e, sleep_hours: v }))}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 7.5"
                  placeholderTextColor={mc.text3}
                />
                <View style={[st.sliderTop, { marginTop: 6 }]}>
                  <Text style={[st.logLabel, { fontSize: 10 }]}>Sleep quality</Text>
                  <Text style={st.sliderVal}>{entry?.sleep_quality || 5}</Text>
                </View>
                <WebSlider min={1} max={10} value={entry?.sleep_quality || 5} onChange={v => setEntry(e => ({ ...e, sleep_quality: v }))} accentColor={accentColor} borderColor={mc.border} />
              </View>
            </View>

            {/* Food log header — .food-log-header */}
            <View style={st.foodLogHeader}>
              <Text style={st.foodLogTitle}>Food Log</Text>
              <View style={{ alignItems: 'flex-end' }}>
                {calorieTarget ? (
                  <Text style={st.foodCalTotal}>
                    {totalCal} / {calorieTarget.calories} kcal
                    {'  '}
                    <Text style={{ color: totalCal > calorieTarget.calories ? '#E57373' : accentColor }}>
                      {totalCal > calorieTarget.calories
                        ? `${totalCal - calorieTarget.calories} over`
                        : `${calorieTarget.calories - totalCal} left`}
                    </Text>
                  </Text>
                ) : (
                  <Text style={st.foodCalTotal}>{totalCal} kcal eaten</Text>
                )}
                {entry?.steps ? (
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>
                    Net: {Math.max(0, totalCal - Math.round(parseInt(entry.steps || 0) * 0.04))} kcal
                    {'  '}(~{Math.round(parseInt(entry.steps || 0) * 0.04)} burned)
                  </Text>
                ) : null}
              </View>
            </View>
            {/* Calorie progress bar + macro mini-bars (shown when SmartTargets target exists) */}
            {calorieTarget && (
              <View style={{ marginBottom: 10 }}>
                <View style={{ height: 4, backgroundColor: mc.border, borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                  <View style={{ height: 4, width: `${Math.min(100, (totalCal / calorieTarget.calories) * 100).toFixed(1)}%`, backgroundColor: totalCal > calorieTarget.calories ? '#E57373' : accentColor, borderRadius: 2 }} />
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[
                    { label: 'P', val: totalProt, goal: calorieTarget.protein, color: '#7C8BF5' },
                    { label: 'C', val: totalCarb, goal: calorieTarget.carbs,   color: '#4CAF7C' },
                    { label: 'F', val: totalFat,  goal: calorieTarget.fat,     color: '#FFB74D' },
                  ].map(m => (
                    <View key={m.label} style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{m.label}</Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{m.val}g / {m.goal}g</Text>
                      </View>
                      <View style={{ height: 3, backgroundColor: mc.border, borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ height: 3, width: `${Math.min(100, (m.val / m.goal) * 100).toFixed(1)}%`, backgroundColor: m.color, borderRadius: 2 }} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Food items — .food-items */}
            <View style={st.foodItems}>
              {(entry.foods || []).length === 0 ? (
                <View>
                  <Text style={[st.noFood, { marginBottom: 10 }]}>Nothing logged yet — tap a common item or use Add below.</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    {[
                      INDIAN_FOODS.find(f => f.name === 'Roti (wheat)'),
                      INDIAN_FOODS.find(f => f.name === 'Egg (boiled)'),
                      INDIAN_FOODS.find(f => f.name === 'Rice (cooked)'),
                      INDIAN_FOODS.find(f => f.name === 'Dal Tadka'),
                      INDIAN_FOODS.find(f => f.name === 'Chicken Curry'),
                      INDIAN_FOODS.find(f => f.name === 'Chai (with milk)'),
                      INDIAN_FOODS.find(f => f.name === 'Curd / Dahi'),
                      INDIAN_FOODS.find(f => f.name === 'Dosa'),
                    ].filter(Boolean).map(food => (
                      <TouchableOpacity key={food.name} onPress={() => quickAddFood(food)}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: mc.border, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text }}>{food.name.split(' (')[0]}</Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: accentColor }}>{food.calories} kcal</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                (() => {
                  const MEAL_GROUPS = [
                    { key: 'breakfast', label: 'BREAKFAST' },
                    { key: 'lunch',     label: 'LUNCH' },
                    { key: 'dinner',    label: 'DINNER' },
                    { key: 'snack',     label: 'SNACK' },
                    { key: null,        label: 'OTHER' },
                  ];
                  const indexedFoods = (entry.foods || []).map((f, idx) => ({ ...f, _idx: idx }));
                  return MEAL_GROUPS.map(group => {
                    const groupFoods = indexedFoods.filter(f => (f.meal || null) === group.key);
                    if (groupFoods.length === 0) return null;
                    return (
                      <View key={group.key || 'other'}>
                        <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 3, color: accentColor, marginTop: 10, marginBottom: 4 }}>
                          {group.label}
                        </Text>
                        {groupFoods.map(f => (
                          <View key={f._idx} style={[st.foodItem, { alignItems: 'flex-start', paddingVertical: 8 }]}>
                            {f.photo ? (
                              <TouchableOpacity onPress={() => capturePhotoForFood(f._idx)}>
                                <Image source={{ uri: f.photo }} style={{ width: 38, height: 38, marginRight: 8, borderRadius: 2 }} />
                              </TouchableOpacity>
                            ) : (
                              Platform.OS === 'web' && (
                                <TouchableOpacity onPress={() => capturePhotoForFood(f._idx)} style={{ width: 38, height: 38, marginRight: 8, borderWidth: 1, borderColor: mc.border, alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>
                                </TouchableOpacity>
                              )
                            )}
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={st.foodItemName} numberOfLines={1}>
                                {f.name}{f.serving ? ` (${f.serving})` : ''}
                              </Text>
                              {f.tag && (
                                <Text style={{ fontFamily: F.mono, fontSize: 9, color: MEAL_TAGS.find(t => t.key === f.tag)?.color || mc.text3 }}>
                                  {MEAL_TAGS.find(t => t.key === f.tag)?.label}
                                </Text>
                              )}
                            </View>
                            <Text style={st.foodItemCal}>{f.calories || 0} kcal</Text>
                            <Text style={st.foodItemMacro}>{f.protein || 0}g P</Text>
                            <TouchableOpacity onPress={() => deleteFood(f._idx)}>
                              <Text style={st.foodItemDel}>X</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    );
                  });
                })()
              )}
            </View>

            {/* Macro breakdown donut — additive chart block */}
            {totalCal > 0 && (
              <View style={{ borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 10 }}>MACRO BREAKDOWN</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <DonutChart
                    segments={[
                      { value: (entry.protein || 0) * 4, color: '#5B9DD9', label: 'Protein' },
                      { value: (entry.carbs   || 0) * 4, color: '#C9A84C', label: 'Carbs' },
                      { value: (entry.fat     || 0) * 9, color: '#E57373', label: 'Fat' },
                    ]}
                    mc={mc}
                  />
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#5B9DD9' }} />
                      <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text2 }}>Protein · {entry.protein || 0}g</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#C9A84C' }} />
                      <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text2 }}>Carbs · {entry.carbs || 0}g</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E57373' }} />
                      <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text2 }}>Fat · {entry.fat || 0}g</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Food actions — .food-actions */}
            <View style={st.foodActions}>
              <TouchableOpacity style={st.foodBtn} onPress={openAddFood}>
                <PlusSvg color={mc.text2} />
                <Text style={st.foodBtnTxt}>Add food</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.foodBtn} onPress={() => setShowScanner(true)} disabled={scanLoading}>
                <Text style={st.foodBtnTxt}>{scanLoading ? 'Looking up…' : '▦  Scan barcode'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.foodBtn} onPress={openPhotoRecognition}>
                <Text style={st.foodBtnTxt}>Snap a photo</Text>
              </TouchableOpacity>
              {templates.length > 0 && (
                <TouchableOpacity style={st.foodBtn} onPress={() => setShowTemplates(true)}>
                  <Text style={st.foodBtnTxt}>⊞  Templates</Text>
                </TouchableOpacity>
              )}
              {(entry?.foods?.length > 0) && (
                <TouchableOpacity style={st.foodBtn} onPress={() => { setTmplName(''); setShowSaveTmpl(true); }}>
                  <Text style={st.foodBtnTxt}>Save meal</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Log footer — .log-footer */}
            <View style={st.logFooter}>
              <TouchableOpacity style={st.logClearBtn} onPress={handleClear}>
                <Text style={st.logClearTxt}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.logSaveBtn} onPress={handleSave}>
                <Text style={st.logSaveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Add Food Modal ── */}
      <Modal
        visible={showFood}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFood(false)}
      >
        <TouchableOpacity style={st.modalBackdrop} activeOpacity={1} onPress={() => setShowFood(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={st.modalBox}>

              {afView === 'photo' ? (
                <>
                  <Text style={st.modalTitle}>Photo recognition</Text>

                  {aiPhotoLoading && (
                    <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                      <ActivityIndicator color={accentColor} />
                      <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginTop: 12 }}>Analyzing your photo…</Text>
                    </View>
                  )}

                  {!aiPhotoLoading && aiPhotoError !== '' && (
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#E57373', paddingVertical: 16 }}>{aiPhotoError}</Text>
                  )}

                  {!aiPhotoLoading && !aiPhotoError && aiPhotoFoods.length === 0 && (
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, paddingVertical: 16 }}>
                      Take or choose a photo of your meal — the AI will identify each item and estimate calories.
                    </Text>
                  )}

                  {!aiPhotoLoading && aiPhotoFoods.length > 0 && (
                    <ScrollView style={{ maxHeight: 320 }}>
                      {aiPhotoFoods.map((item, i) => {
                        const added = aiPhotoAdded.includes(i);
                        return (
                          <View key={i} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text }}>{item.name}</Text>
                              <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor, marginTop: 2 }}>
                                {item.calories} kcal · {item.protein}g P · {item.carbs}g C · {item.fat}g F · {item.serving}
                              </Text>
                            </View>
                            <TouchableOpacity
                              disabled={added}
                              onPress={() => addDetectedFood(item, i)}
                              style={{ paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: added ? mc.border : accentColor, backgroundColor: added ? 'transparent' : accentColor + '18' }}
                            >
                              <Text style={{ fontFamily: F.mono, fontSize: 11, color: added ? mc.text3 : accentColor }}>{added ? 'Added' : 'Add'}</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}

                  <View style={[st.modalActions, { marginTop: 14 }]}>
                    <TouchableOpacity style={st.modalCancel} onPress={() => setShowFood(false)}>
                      <Text style={st.modalCancelTxt}>Done</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={st.modalCancel} onPress={() => aiPhotoInputRef.current?.click()}>
                      <Text style={[st.modalCancelTxt, { color: accentColor }]}>{aiPhotoFoods.length || aiPhotoError ? 'Try another photo' : 'Choose photo'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : afView === 'search' ? (
                <>
                  <Text style={st.modalTitle}>Search food</Text>

                  {/* Search input */}
                  <View style={st.modalField}>
                    <TextInput
                      style={[st.modalInput, { marginBottom: 0 }]}
                      value={afSearchQ}
                      onChangeText={onSearchChange}
                      placeholder="Type food name — banana, dal, oats…"
                      placeholderTextColor={mc.text3}
                      autoFocus
                    />
                  </View>

                  {/* Results */}
                  <ScrollView style={{ maxHeight: 320, marginTop: 10 }} keyboardShouldPersistTaps="handled">
                    {afSearching && (
                      <ActivityIndicator color={accentColor} style={{ marginVertical: 16 }} />
                    )}
                    {!afSearching && afSearchQ.trim() !== '' && afResults.length === 0 && (
                      <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, padding: 8 }}>
                        No results — try a different name or enter manually
                      </Text>
                    )}
                    {afResults.map((item, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => selectFoodResult(item)}
                        style={{ paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: mc.border }}
                      >
                        <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text }} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {!!item.brand && (
                          <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{item.brand}</Text>
                        )}
                        <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor, marginTop: 2 }}>
                          {item.calories} kcal · {item.protein}g P · {item.carbs}g C · per 100g
                        </Text>
                      </TouchableOpacity>
                    ))}

                    {/* Indian food quick-add (shown when search is empty) */}
                    {!afSearching && afSearchQ.trim() === '' && (
                      <>
                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 1, paddingVertical: 8 }}>
                          QUICK ADD — INDIAN FOODS
                        </Text>
                        {INDIAN_FOODS.map((item, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => selectFoodResult(item)}
                            style={{ paddingVertical: 9, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: mc.border }}
                          >
                            <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{item.name}</Text>
                            <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor }}>
                              {item.calories} kcal · {item.protein}g P · {item.carbs}g C · {item.serving}
                            </Text>
                          </TouchableOpacity>
                        ))}

                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 1, paddingVertical: 8, marginTop: 8 }}>
                          QUICK ADD — DRINKS
                        </Text>
                        {DRINKS.map((item, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => selectFoodResult(item)}
                            style={{ paddingVertical: 9, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: mc.border }}
                          >
                            <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{item.name}</Text>
                            <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor }}>
                              {item.calories} kcal · {item.alcohol}g alcohol · {item.serving}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                  </ScrollView>

                  {/* Actions */}
                  <View style={[st.modalActions, { marginTop: 14 }]}>
                    <TouchableOpacity style={st.modalCancel} onPress={() => setShowFood(false)}>
                      <Text style={st.modalCancelTxt}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={st.modalCancel} onPress={() => { setAfName(''); setAfCal(''); setAfServing(''); setAfProtein(''); setAfCarbs(''); setAfView('manual'); }}>
                      <Text style={[st.modalCancelTxt, { color: accentColor }]}>Enter manually</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={st.modalTitle}>Add food item</Text>

                  <View style={st.modalField}>
                    <Text style={st.modalLabel}>Food name</Text>
                    <TextInput style={st.modalInput} value={afName} onChangeText={setAfName} placeholder="e.g. Dal rice, banana" placeholderTextColor={mc.text3} autoFocus />
                  </View>

                  <View style={st.modalRow}>
                    <View style={[st.modalField, { flex: 1, marginRight: 12 }]}>
                      <Text style={st.modalLabel}>Calories (kcal)</Text>
                      <TextInput style={st.modalInput} value={afCal} onChangeText={setAfCal} keyboardType="number-pad" placeholder="350" placeholderTextColor={mc.text3} />
                    </View>
                    <View style={[st.modalField, { flex: 1 }]}>
                      <Text style={st.modalLabel}>Serving size</Text>
                      <TextInput style={st.modalInput} value={afServing} onChangeText={setAfServing} placeholder="100g, 1 plate…" placeholderTextColor={mc.text3} />
                    </View>
                  </View>

                  <View style={st.modalRow}>
                    <View style={[st.modalField, { flex: 1, marginRight: 12 }]}>
                      <Text style={st.modalLabel}>Protein (g)</Text>
                      <TextInput style={st.modalInput} value={afProtein} onChangeText={setAfProtein} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={mc.text3} />
                    </View>
                    <View style={[st.modalField, { flex: 1 }]}>
                      <Text style={st.modalLabel}>Carbs (g)</Text>
                      <TextInput style={st.modalInput} value={afCarbs} onChangeText={setAfCarbs} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={mc.text3} />
                    </View>
                  </View>

                  <View style={st.modalField}>
                    <Text style={st.modalLabel}>Alcohol (g) — optional</Text>
                    <TextInput style={st.modalInput} value={afAlcohol} onChangeText={setAfAlcohol} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={mc.text3} />
                  </View>

                  {/* Tag selector */}
                  <View style={{ marginBottom: 12 }}>
                    <Text style={st.modalLabel}>Tag (optional)</Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {MEAL_TAGS.map(t => (
                        <TouchableOpacity
                          key={t.key}
                          onPress={() => setAfTag(afTag === t.key ? null : t.key)}
                          style={{
                            paddingHorizontal: 10, paddingVertical: 5,
                            borderWidth: 1,
                            borderColor: afTag === t.key ? t.color : mc.border,
                            backgroundColor: afTag === t.key ? t.color + '20' : 'transparent',
                          }}
                        >
                          <Text style={{ fontFamily: F.mono, fontSize: 11, color: afTag === t.key ? t.color : mc.text3 }}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={st.modalActions}>
                    <TouchableOpacity style={st.modalCancel} onPress={() => setAfView('search')}>
                      <Text style={st.modalCancelTxt}>← Search</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={st.modalOk} onPress={submitAddFood}>
                      <Text style={st.modalOkTxt}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Meal Templates Modal ── */}
      <Modal visible={showTemplates} transparent animationType="fade" onRequestClose={() => setShowTemplates(false)}>
        <TouchableOpacity style={st.modalBackdrop} activeOpacity={1} onPress={() => setShowTemplates(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={st.modalBox}>
              <Text style={st.modalTitle}>Meal Templates</Text>
              <ScrollView style={{ maxHeight: 320 }}>
                {templates.map(t => (
                  <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text }}>{t.name}</Text>
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>
                        {t.foods.length} items · {t.foods.reduce((s, f) => s + (f.calories || 0), 0)} kcal
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => applyTemplate(t)} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: accentColor, marginRight: 8 }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#0A0A0A', fontWeight: '700' }}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteTemplate(t.id)} style={{ padding: 4 }}>
                      <Svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke={mc.text3} strokeWidth={2.2} strokeLinecap="round">
                        <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
                      </Svg>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              <View style={[st.modalActions, { marginTop: 12 }]}>
                <TouchableOpacity style={st.modalCancel} onPress={() => setShowTemplates(false)}>
                  <Text style={st.modalCancelTxt}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Save Meal Template Modal ── */}
      <Modal visible={showSaveTmpl} transparent animationType="fade" onRequestClose={() => setShowSaveTmpl(false)}>
        <TouchableOpacity style={st.modalBackdrop} activeOpacity={1} onPress={() => setShowSaveTmpl(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={st.modalBox}>
              <Text style={st.modalTitle}>Save as template</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 12 }}>
                Saves your current {entry?.foods?.length || 0} food items as a reusable meal template.
              </Text>
              <View style={st.modalField}>
                <Text style={st.modalLabel}>Template name</Text>
                <TextInput
                  style={st.modalInput}
                  value={tmplName}
                  onChangeText={setTmplName}
                  placeholder="e.g. My usual breakfast"
                  placeholderTextColor={mc.text3}
                  autoFocus
                />
              </View>
              <View style={st.modalActions}>
                <TouchableOpacity style={st.modalCancel} onPress={() => setShowSaveTmpl(false)}>
                  <Text style={st.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.modalOk} onPress={saveTemplate}>
                  <Text style={st.modalOkTxt}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Mindfulness Check-in Modal ── */}
      <Modal visible={showMindful} transparent animationType="fade" onRequestClose={() => setShowMindful(false)}>
        <TouchableOpacity style={st.modalBackdrop} activeOpacity={1} onPress={() => setShowMindful(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={st.modalBox}>
              <Text style={st.modalTitle}>How did your eating feel today?</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 16 }}>
                A moment of reflection builds better habits.
              </Text>
              {MINDFUL_OPTS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  onPress={() => { setMindfulRating(o.key); setShowMindful(false); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 12, paddingHorizontal: 14,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: mindfulRating === o.key ? accentColor : mc.border,
                    backgroundColor: mindfulRating === o.key ? accentColor + '15' : 'transparent',
                  }}
                >
                  <View>
                    <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text }}>{o.label}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 2 }}>{o.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[st.modalCancel, { marginTop: 4 }]} onPress={() => setShowMindful(false)}>
                <Text style={st.modalCancelTxt}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Hidden file input for meal photo capture (web only) */}
      {Platform.OS === 'web' && React.createElement('input', {
        ref: photoInputRef,
        type: 'file',
        accept: 'image/*',
        style: { display: 'none' },
        onChange: handlePhotoCapture,
      })}

      {/* Hidden file input for AI photo food recognition (web only) */}
      {Platform.OS === 'web' && React.createElement('input', {
        ref: aiPhotoInputRef,
        type: 'file',
        accept: 'image/*',
        capture: 'environment',
        style: { display: 'none' },
        onChange: handleAiPhotoCapture,
      })}

      <BarcodeScanner
        visible={showScanner}
        onScanned={handleScanned}
        onClose={() => setShowScanner(false)}
      />

    </ScrollView>
    {fastToast ? (
      <View style={{ position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
        <View style={{ backgroundColor: '#C9A84C', paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#0A0A0A', fontWeight: '700' }}>{fastToast}</Text>
        </View>
      </View>
    ) : null}
    </View>
  );
}

