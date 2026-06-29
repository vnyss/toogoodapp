import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Modal, ActivityIndicator, Platform,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { C, F } from '../theme';
import { useTheme } from '../ThemeContext';
import { aiChat, fetchLogs, syncLogs, awardXP, lookupBarcode, searchFood } from '../api';
import BarcodeScanner from '../components/BarcodeScanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, getUser } from '../auth';

// ─── helpers ───────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10); }

function dateLabel() {
  const iso = today();
  const d = new Date(iso + 'T00:00');
  return d.toLocaleDateString('en', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).toUpperCase();
}

function emptyEntry() {
  return {
    date: today(), weight: '', steps: '', workout: '',
    hunger: 5, energy: 5, foods: [],
    calories: 0, protein: 0, carbs: 0, fat: 0,
    water: 0, sleep_hours: '', sleep_quality: 5,
  };
}

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
      const key = `toogood_daily_logs_${u}`;
      setLogKey(key);
      loadEntry(key);
      const raw = await AsyncStorage.getItem(`toogood_meal_templates_${u}`);
      if (raw) setTemplates(JSON.parse(raw));
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
  const totalCal = (entry?.foods || []).reduce((s, f) => s + (f.calories || 0), 0);

  function openAddFood() {
    setAfView('search');
    setAfSearchQ(''); setAfResults([]); setAfSearching(false);
    setAfName(''); setAfCal(''); setAfServing('');
    setAfProtein(''); setAfCarbs('');
    setShowFood(true);
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
      setShowFood(true);
    } catch {
      setAfName(''); setAfCal(''); setAfServing(''); setAfProtein(''); setAfCarbs('');
      setShowFood(true);
    } finally {
      setScanLoading(false);
    }
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
      if (logged.weight  != null) upd.weight  = String(logged.weight);
      if (logged.steps   != null) upd.steps   = String(logged.steps);
      if (logged.workout)         upd.workout  = logged.workout;
      if (logged.hunger  != null) setHunger(logged.hunger);
      if (logged.energy  != null) setEnergy(logged.energy);
      if (logged.foods?.length) {
        const existing = new Set((upd.foods || []).map(f => f.name.toLowerCase().trim()));
        const toAdd = (logged.foods || []).filter(
          f => !existing.has((f.name || '').toLowerCase().trim())
        ).map(f => ({
          name: f.name || '', serving: f.serving || '',
          calories: f.calories || 0, protein: f.protein || 0,
          carbs: f.carbs || 0, fat: f.fat || 0,
        }));
        const foods = [...(upd.foods || []), ...toAdd];
        upd.foods    = foods;
        upd.calories = foods.reduce((s, f) => s + (f.calories || 0), 0);
        upd.protein  = foods.reduce((s, f) => s + (f.protein  || 0), 0);
        upd.carbs    = foods.reduce((s, f) => s + (f.carbs    || 0), 0);
      }
      return upd;
    });
    // Show form state after AI fills in data
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
                <Text style={st.foodCalTotal}>{totalCal} kcal eaten</Text>
                {entry?.steps ? (
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>
                    Net: {Math.max(0, totalCal - Math.round(parseInt(entry.steps || 0) * 0.04))} kcal
                    {'  '}(~{Math.round(parseInt(entry.steps || 0) * 0.04)} burned)
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Food items — .food-items */}
            <View style={st.foodItems}>
              {(entry.foods || []).length === 0 ? (
                <Text style={st.noFood}>Nothing logged yet. Add your first meal below.</Text>
              ) : (
                (entry.foods || []).map((f, i) => (
                  <View key={i} style={st.foodItem}>
                    <Text style={st.foodItemName} numberOfLines={1}>
                      {f.name}{f.serving ? ` (${f.serving})` : ''}
                    </Text>
                    <Text style={st.foodItemCal}>{f.calories || 0} kcal</Text>
                    <Text style={st.foodItemMacro}>{f.protein || 0}g P</Text>
                    <TouchableOpacity onPress={() => deleteFood(i)}>
                      <Text style={st.foodItemDel}>X</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* Food actions — .food-actions */}
            <View style={st.foodActions}>
              <TouchableOpacity style={st.foodBtn} onPress={openAddFood}>
                <PlusSvg color={mc.text2} />
                <Text style={st.foodBtnTxt}>Add food</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.foodBtn} onPress={() => setShowScanner(true)} disabled={scanLoading}>
                <Text style={st.foodBtnTxt}>{scanLoading ? 'Looking up…' : '▦  Scan barcode'}</Text>
              </TouchableOpacity>
              {templates.length > 0 && (
                <TouchableOpacity style={st.foodBtn} onPress={() => setShowTemplates(true)}>
                  <Text style={st.foodBtnTxt}>⊞  Templates</Text>
                </TouchableOpacity>
              )}
              {(entry?.foods?.length > 0) && (
                <TouchableOpacity style={st.foodBtn} onPress={() => { setTmplName(''); setShowSaveTmpl(true); }}>
                  <Text style={st.foodBtnTxt}>💾  Save meal</Text>
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

              {afView === 'search' ? (
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
                  <ScrollView style={{ maxHeight: 280, marginTop: 10 }} keyboardShouldPersistTaps="handled">
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
                    <TouchableOpacity onPress={() => deleteTemplate(t.id)}>
                      <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>✕</Text>
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

      <BarcodeScanner
        visible={showScanner}
        onScanned={handleScanned}
        onClose={() => setShowScanner(false)}
      />

    </ScrollView>
  );
}

