import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Animated, Dimensions, Modal,
} from 'react-native';
import Svg, { Path, Circle, Line, Rect, Polyline, Polygon } from 'react-native-svg';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { getScore, leaderboard, awardXP, aiChat, fetchLogs, syncLogs, getMe, lookupBarcode } from '../api';
import { getToken, getUser } from '../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BarcodeScanner from '../components/BarcodeScanner';

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function hToTimeStr(h) {
  const hh = Math.floor(h) % 12 || 12;
  const mm = Math.round((h - Math.floor(h)) * 60);
  const suf = Math.floor(h) < 12 ? 'am' : 'pm';
  return mm ? `${hh}:${String(mm).padStart(2, '0')}${suf}` : `${hh}${suf}`;
}

// ─────────────────────────────────────────────────────────────
//  EMBEDDED LOG SECTION  (matches index.html Log Today section)
// ─────────────────────────────────────────────────────────────
function EmbeddedLog({ username, mc, accentColor, fontSize, borderRadius }) {
  const [entry,    setEntry]    = useState(null);
  const [saved,    setSaved]    = useState(false);
  const [hunger,   setHunger]   = useState(5);
  const [energy,   setEnergy]   = useState(5);
  const [logKey,   setLogKey]   = useState('');
  const [showFood, setShowFood] = useState(false);
  const [afName,   setAfName]   = useState('');
  const [afCal,    setAfCal]    = useState('');
  const [afServ,   setAfServ]   = useState('');

  useEffect(() => {
    if (!username) return;
    const key = `toogood_daily_logs_${username}`;
    setLogKey(key);
    AsyncStorage.getItem(key).then(async raw => {
      let localLogs = raw ? JSON.parse(raw) : [];
      try {
        const d = await fetchLogs();
        if (d?.ok && d.logs?.length) {
          const serverMap = {};
          d.logs.forEach(l => { serverMap[l.date] = l; });
          const localMap = {};
          localLogs.forEach(l => { localMap[l.date] = l; });
          const merged = Object.values({ ...serverMap, ...localMap });
          merged.sort((a, b) => b.date.localeCompare(a.date));
          await AsyncStorage.setItem(key, JSON.stringify(merged));
          localLogs = merged;
        }
      } catch {}
      const ex = localLogs.find(l => l.date === todayISO());
      if (ex) {
        setEntry(ex);
        setSaved(!!(ex.saved || ex.calories > 0 || ex.weight || ex.workout));
        setHunger(ex.hunger || 5);
        setEnergy(ex.energy || 5);
      } else {
        setEntry({ date: todayISO(), weight: '', steps: '', workout: '', hunger: 5, energy: 5, foods: [], calories: 0, protein: 0, carbs: 0, fat: 0 });
      }
    });
  }, [username]);

  async function persist(e) {
    const raw = await AsyncStorage.getItem(logKey);
    const logs = raw ? JSON.parse(raw) : [];
    const idx = logs.findIndex(l => l.date === e.date);
    if (idx >= 0) logs[idx] = e; else logs.unshift(e);
    await AsyncStorage.setItem(logKey, JSON.stringify(logs));
    syncLogs([e]).catch(() => {});
  }

  async function handleSave() {
    if (!entry) return;
    const updated = {
      ...entry, hunger, energy, saved: true,
      calories: (entry.foods || []).reduce((s, f) => s + (f.calories || 0), 0),
    };
    await persist(updated);
    setEntry(updated);
    if (updated.workout?.trim()) awardXP('exercise').catch(() => {});
    if (updated.calories > 0)   awardXP('food_log').catch(() => {});
    setSaved(true);
  }

  async function handleClear() {
    if (!logKey) return;
    const raw = await AsyncStorage.getItem(logKey);
    const logs = (raw ? JSON.parse(raw) : []).filter(l => l.date !== todayISO());
    await AsyncStorage.setItem(logKey, JSON.stringify(logs));
    setEntry({ date: todayISO(), weight: '', steps: '', workout: '', hunger: 5, energy: 5, foods: [], calories: 0, protein: 0, carbs: 0, fat: 0 });
    setHunger(5); setEnergy(5); setSaved(false);
  }

  function addFood() {
    if (!afName.trim()) return;
    const food = { name: afName.trim(), serving: afServ.trim(), calories: parseInt(afCal) || 0 };
    setEntry(e => ({ ...e, foods: [...(e.foods || []), food] }));
    setAfName(''); setAfCal(''); setAfServ('');
    setShowFood(false);
  }

  const totalCal = (entry?.foods || []).reduce((s, f) => s + (f.calories || 0), 0);
  const doneLabel = [
    entry?.weight  && `${entry.weight} kg`,
    entry?.steps   && `${entry.steps} steps`,
    totalCal > 0   && `${totalCal} kcal`,
  ].filter(Boolean).join(' · ');

  const doneStats = [
    entry?.weight   ? { v: entry.weight + ' kg', l: 'Weight' }       : null,
    totalCal > 0    ? { v: totalCal + ' kcal', l: 'Calories' }       : null,
    entry?.protein  ? { v: entry.protein + 'g', l: 'Protein' }       : null,
    entry?.steps    ? { v: String(entry.steps), l: 'Steps' }          : null,
    entry?.workout  ? { v: entry.workout, l: 'Activity' }             : null,
  ].filter(Boolean);

  const lg = StyleSheet.create({
    card:         { backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, padding: 28, paddingHorizontal: 32 },
    date:         { fontSize: 11, color: mc.text3, letterSpacing: 5, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 20 },
    row:          { flexDirection: 'row', gap: 20, marginBottom: 20 },
    field:        { flex: 1, gap: 6 },
    label:        { fontSize: 10, color: mc.text3, letterSpacing: 5, textTransform: 'uppercase', fontFamily: F.mono },
    input:        { backgroundColor: mc.elevated, borderBottomWidth: 1, borderBottomColor: mc.border, color: mc.text, fontFamily: F.mono, fontSize: fontSize, paddingVertical: 7, letterSpacing: 0.5, outlineWidth: 0 },
    sliderVal:    { fontFamily: F.display, fontSize: 16, color: accentColor },
    foodHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: mc.border, paddingTop: 20, marginTop: 4, marginBottom: 12 },
    foodTitle:    { fontSize: 11, color: mc.text3, letterSpacing: 5, textTransform: 'uppercase', fontFamily: F.mono },
    foodCalTotal: { fontFamily: F.display, fontSize: 16, color: accentColor },
    noFood:       { fontSize: Math.max(10, fontSize - 2), color: mc.text3, fontFamily: F.mono, paddingBottom: 12, letterSpacing: 1, fontStyle: 'italic' },
    foodItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.06)', gap: 10 },
    foodItemName: { flex: 1, fontSize: fontSize, color: mc.text, fontFamily: F.mono },
    foodItemMacro:{ fontSize: Math.max(10, fontSize - 2), color: mc.text3, fontFamily: F.mono, minWidth: 80, textAlign: 'right' },
    foodItemCal:  { fontSize: fontSize, color: accentColor, fontFamily: F.display, minWidth: 60, textAlign: 'right' },
    foodItemDel:  { fontSize: fontSize, color: mc.text3, fontFamily: F.mono, paddingHorizontal: 4 },
    foodActions:  { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 4 },
    foodBtn:      { paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: mc.border, flexDirection: 'row', alignItems: 'center', gap: 7 },
    foodBtnTxt:   { fontSize: Math.max(10, fontSize - 2), color: mc.text2, fontFamily: F.mono, letterSpacing: 2 },
    addFoodRow:   { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 4 },
    addFoodBtn:   { paddingVertical: 7, paddingHorizontal: 14, backgroundColor: accentColor },
    addFoodBtnTxt:{ fontSize: Math.max(10, fontSize - 2), color: '#060606', fontFamily: F.mono, fontWeight: '700' },
    footer:       { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
    saveBtn:      { paddingVertical: 10, paddingHorizontal: 28, backgroundColor: accentColor },
    saveBtnTxt:   { fontSize: Math.max(10, fontSize - 2), color: '#060606', fontFamily: F.mono, fontWeight: '700', letterSpacing: 3, textTransform: 'uppercase' },
    // Done state
    doneBanner:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: mc.border, marginBottom: 18 },
    doneCheck:    { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(76,175,124,0.15)', borderWidth: 1, borderColor: 'rgba(76,175,124,0.4)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    doneLabel:    { fontSize: fontSize, color: mc.text, fontFamily: F.mono, letterSpacing: 1 },
    doneSub:      { fontSize: 11, color: mc.text3, fontFamily: F.mono, letterSpacing: 1.5, marginTop: 2 },
    doneStats:    { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingVertical: 12 },
    doneStat:     { gap: 3 },
    doneStatVal:  { fontSize: 16, color: accentColor, fontFamily: F.mono, letterSpacing: 1 },
    doneStatLbl:  { fontSize: 10, color: mc.text3, fontFamily: F.mono, letterSpacing: 4, textTransform: 'uppercase' },
    doneActions:  { flexDirection: 'row', gap: 10, marginTop: 16 },
    clearBtn:     { paddingVertical: 8, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(192,80,80,0.3)' },
    clearBtnTxt:  { fontSize: 11, color: '#C05050', fontFamily: F.mono, letterSpacing: 2.5, textTransform: 'uppercase' },
  });

  return (
    <View style={lg.card}>
      {/* log-date */}
      <Text style={lg.date}>{todayStr().toUpperCase()}</Text>

      {saved ? (
        /* ── Done state ── */
        <View>
          <View style={lg.doneBanner}>
            <View style={lg.doneCheck}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#4CAF7C" strokeWidth={2.5} strokeLinecap="round">
                <Polyline points="20 6 9 17 4 12" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={lg.doneLabel}>Already logged for today</Text>
              {!!doneLabel && <Text style={lg.doneSub}>{doneLabel}</Text>}
            </View>
          </View>
          {doneStats.length > 0 && (
            <View style={lg.doneStats}>
              {doneStats.map((s, i) => (
                <View key={i} style={lg.doneStat}>
                  <Text style={lg.doneStatVal}>{s.v}</Text>
                  <Text style={lg.doneStatLbl}>{s.l}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={lg.doneActions}>
            <TouchableOpacity style={lg.clearBtn} onPress={handleClear}>
              <Text style={lg.clearBtnTxt}>Clear and re-log</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* ── Form state ── */
        <>
          {/* Weight + Steps row */}
          <View style={lg.row}>
            <View style={lg.field}>
              <Text style={lg.label}>Weight (kg)</Text>
              <TextInput
                style={lg.input}
                value={entry?.weight || ''}
                onChangeText={v => setEntry(e => ({ ...e, weight: v }))}
                keyboardType="decimal-pad"
                placeholder="e.g. 74.5"
                placeholderTextColor={mc.text3}
              />
            </View>
            <View style={lg.field}>
              <Text style={lg.label}>Steps</Text>
              <TextInput
                style={lg.input}
                value={entry?.steps || ''}
                onChangeText={v => setEntry(e => ({ ...e, steps: v }))}
                keyboardType="number-pad"
                placeholder="e.g. 8500"
                placeholderTextColor={mc.text3}
              />
            </View>
          </View>

          {/* Workout — full width */}
          <View style={[lg.field, { marginBottom: 20 }]}>
            <Text style={lg.label}>Workout / Activity</Text>
            <TextInput
              style={lg.input}
              value={entry?.workout || ''}
              onChangeText={v => setEntry(e => ({ ...e, workout: v }))}
              placeholder="e.g. 30 min walk, yoga, rest day"
              placeholderTextColor={mc.text3}
            />
          </View>

          {/* Sliders */}
          <View style={lg.row}>
            <View style={lg.field}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={lg.label}>Hunger level</Text>
                <Text style={lg.sliderVal}>{hunger}</Text>
              </View>
              {/* Web-only range input */}
              <input
                type="range" min="1" max="10" value={hunger}
                onChange={ev => setHunger(Number(ev.target.value))}
                style={{ width: '100%', accentColor: '#C9A84C', cursor: 'pointer', height: 4 }}
              />
            </View>
            <View style={lg.field}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={lg.label}>Energy level</Text>
                <Text style={lg.sliderVal}>{energy}</Text>
              </View>
              <input
                type="range" min="1" max="10" value={energy}
                onChange={ev => setEnergy(Number(ev.target.value))}
                style={{ width: '100%', accentColor: '#C9A84C', cursor: 'pointer', height: 4 }}
              />
            </View>
          </View>

          {/* Food log header */}
          <View style={lg.foodHeader}>
            <Text style={lg.foodTitle}>Food Log</Text>
            <Text style={lg.foodCalTotal}>{totalCal} kcal</Text>
          </View>

          {/* Food items */}
          {(entry?.foods || []).length === 0 ? (
            <Text style={lg.noFood}>Nothing logged yet. Add your first meal below.</Text>
          ) : (entry.foods || []).map((f, i) => (
            <View key={i} style={lg.foodItem}>
              <Text style={lg.foodItemName}>{f.name}</Text>
              {!!f.serving && <Text style={lg.foodItemMacro}>{f.serving}</Text>}
              <Text style={lg.foodItemCal}>{f.calories} kcal</Text>
              <TouchableOpacity onPress={() => setEntry(e => ({ ...e, foods: e.foods.filter((_, j) => j !== i) }))}>
                <Text style={lg.foodItemDel}>x</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add food inline */}
          {showFood ? (
            <View style={lg.addFoodRow}>
              <TextInput style={[lg.input, { flex: 2 }]} value={afName} onChangeText={setAfName} placeholder="Food name" placeholderTextColor={mc.text3} />
              <TextInput style={[lg.input, { flex: 1 }]} value={afServ} onChangeText={setAfServ} placeholder="Serving" placeholderTextColor={mc.text3} />
              <TextInput style={[lg.input, { flex: 1 }]} value={afCal} onChangeText={setAfCal} placeholder="kcal" placeholderTextColor={mc.text3} keyboardType="number-pad" />
              <TouchableOpacity onPress={addFood} style={lg.addFoodBtn}><Text style={lg.addFoodBtnTxt}>Add</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={lg.foodActions}>
              <TouchableOpacity style={lg.foodBtn} onPress={() => setShowFood(true)}>
                <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth={2.5} strokeLinecap="round">
                  <Path d="M12 5v14M5 12h14" />
                </Svg>
                <Text style={lg.foodBtnTxt}>Add food</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Footer */}
          <View style={lg.footer}>
            <TouchableOpacity style={lg.saveBtn} onPress={handleSave}>
              <Text style={lg.saveBtnTxt}>Save</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}


// ─────────────────────────────────────────────────────────────
//  EMBEDDED ASSISTANT SECTION  (matches .asst-card in index.html)
// ─────────────────────────────────────────────────────────────
function EmbeddedAssistant({ mc, accentColor, fontSize, borderRadius }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const scrollRef = useRef(null);
  const SK = 'tg_ai_history';

  useEffect(() => {
    AsyncStorage.getItem(SK).then(v => { if (v) setMessages(JSON.parse(v)); });
  }, []);

  async function send(text) {
    text = (text || input).trim();
    if (!text || loading) return;
    setInput('');
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const d = await aiChat(text, messages.map(m => ({ role: m.role, content: m.content })));
      const withReply = [...next, { role: 'assistant', content: d.reply || 'No response.' }];
      setMessages(withReply);
      AsyncStorage.setItem(SK, JSON.stringify(withReply.slice(-60)));
      if (d.logged?.foods?.length > 0) awardXP('food_log').catch(() => {});
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Could not reach server.' }]);
    }
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  const CHIPS = [
    'I had idli and sambar for breakfast',
    'Just did a 30 min run',
    'My weight is 72 kg today',
    'Had rice, dal and sabzi for lunch, about 400g',
  ];

  const as = StyleSheet.create({
    card:      { borderWidth: 1, borderColor: mc.border, borderRadius: borderRadius, overflow: 'hidden', height: 420 },
    msgs:      { padding: 18, gap: 12, flexGrow: 1 },
    welcome:   { fontSize: Math.max(10, fontSize - 2), color: mc.text3, fontFamily: F.mono, letterSpacing: 1, lineHeight: 20 },
    chips:     { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
    chip:      { borderWidth: 1, borderColor: mc.border, borderRadius: Math.max(4, borderRadius - 2), paddingVertical: 5, paddingHorizontal: 12 },
    chipTxt:   { fontFamily: F.mono, fontSize: 10, color: mc.text2, letterSpacing: 1 },
    bubble:    { maxWidth: '84%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: borderRadius },
    bubbleUser:{ backgroundColor: accentColor, alignSelf: 'flex-end', borderBottomRightRadius: 3 },
    bubbleAI:  { backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, alignSelf: 'flex-start', borderBottomLeftRadius: 3 },
    bubbleTxt: { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), lineHeight: 20, color: mc.text, letterSpacing: 0.5 },
    composer:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: mc.border, backgroundColor: mc.surface },
    ta:        { flex: 1, color: mc.text, fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), paddingVertical: 4, maxHeight: 100, lineHeight: 20, outlineWidth: 0, backgroundColor: 'transparent' },
    send:      { width: 32, height: 32, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius, flexShrink: 0 },
  });

  return (
    <View style={as.card}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={as.msgs}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 && (
          <View>
            <Text style={as.welcome}>No form needed. Just describe your meal, workout, or weight and I'll handle the logging automatically.</Text>
            <View style={as.chips}>
              {CHIPS.map(c => (
                <TouchableOpacity key={c} style={as.chip} onPress={() => send(c)}>
                  <Text style={as.chipTxt}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {messages.map((m, i) => (
          <View key={i} style={[as.bubble, m.role === 'user' ? as.bubbleUser : as.bubbleAI]}>
            <Text style={[as.bubbleTxt, m.role === 'user' && { color: '#060606' }]}>{m.content}</Text>
          </View>
        ))}
        {loading && (
          <View style={[as.bubble, as.bubbleAI]}>
            <Text style={[as.bubbleTxt, { color: mc.text3, fontStyle: 'italic' }]}>Thinking…</Text>
          </View>
        )}
      </ScrollView>
      {/* Composer */}
      <View style={as.composer}>
        <TextInput
          style={as.ta}
          value={input}
          onChangeText={setInput}
          placeholder="What did you eat? How was your workout?…"
          placeholderTextColor={mc.text3}
          multiline
        />
        <TouchableOpacity style={as.send} onPress={() => send()} disabled={loading}>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#060606" strokeWidth={2.2} strokeLinecap="round">
            <Line x1="22" y1="2" x2="11" y2="13" />
            <Polygon points="22 2 15 22 11 13 2 9 22 2" />
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
}


// ─────────────────────────────────────────────────────────────
//  TG·ADAPT SECTION  (matches .adapt-card in index.html)
// ─────────────────────────────────────────────────────────────
function EmbeddedAdapt({ username, mc, accentColor, fontSize, borderRadius }) {
  const [plan,   setPlan]   = useState({});
  const [stats,  setStats]  = useState({ avgCal: 0, wtChange: null, days: 0 });
  const [target, setTarget] = useState('');
  const [planKey, setPlanKey] = useState('');

  useEffect(() => {
    if (!username) return;
    const lk = `toogood_daily_logs_${username}`;
    const pk = `toogood_user_plan_${username}`;
    setPlanKey(pk);
    AsyncStorage.multiGet([lk, pk]).then(([[, rawLogs], [, rawPlan]]) => {
      const logs = rawLogs ? JSON.parse(rawLogs) : [];
      const p    = rawPlan ? JSON.parse(rawPlan) : {};
      setPlan(p);
      if (p.target_calories) setTarget(String(p.target_calories));
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
      const week   = logs.filter(l => new Date(l.date + 'T00:00') >= cutoff);
      const calLogs = week.filter(l => l.calories > 0);
      const wtLogs  = week.filter(l => l.weight && parseFloat(l.weight) > 0).sort((a, b) => a.date.localeCompare(b.date));
      const avgCal  = calLogs.length ? Math.round(calLogs.reduce((s, l) => s + l.calories, 0) / calLogs.length) : 0;
      const wtChange = wtLogs.length >= 2 ? (parseFloat(wtLogs[wtLogs.length - 1].weight) - parseFloat(wtLogs[0].weight)).toFixed(1) : null;
      setStats({ avgCal, wtChange, days: calLogs.length });
    }).catch(() => {});
  }, [username]);

  async function saveTarget() {
    const val = parseInt(target);
    if (!val || val < 800 || val > 6000) return;
    const newPlan = { ...plan, target_calories: val };
    await AsyncStorage.setItem(planKey, JSON.stringify(newPlan));
    setPlan(newPlan);
  }

  const tgt  = parseInt(target) || plan.target_calories || 0;
  const diff = tgt && stats.avgCal ? stats.avgCal - tgt : null;

  let insight = 'Log your weight and food for at least 3 days to unlock your first weekly insight.';
  let badgeType = null;
  if (stats.days >= 3 && tgt) {
    if (diff === null)               { insight = 'Set your daily calorie target below to get started.'; }
    else if (Math.abs(diff) <= 150)  { insight = `You're eating right on target — excellent consistency.`; badgeType = 'ok'; }
    else if (diff > 0)               { insight = `You're averaging ${Math.abs(diff)} kcal over your target. Consider slightly smaller portions.`; badgeType = 'warn'; }
    else                             { insight = `You're averaging ${Math.abs(diff)} kcal under target. Make sure you're eating enough.`; badgeType = 'adj'; }
  }

  const badgeLabel = badgeType === 'ok' ? 'On track' : badgeType === 'warn' ? 'Over target' : badgeType === 'adj' ? 'Under target' : 'Set up plan';
  const effectiveBadgeType = badgeType || 'warn';
  const bdColors = {
    ok:   { bg: 'rgba(76,175,130,0.1)',   border: 'rgba(76,175,130,0.3)',   text: C.green },
    warn: { bg: 'rgba(201,168,76,0.08)',  border: 'rgba(201,168,76,0.3)',   text: accentColor  },
    adj:  { bg: 'rgba(207,102,121,0.08)', border: 'rgba(207,102,121,0.3)', text: C.red   },
  };
  const bc = bdColors[effectiveBadgeType];

  const MEAL_PLAN = [
    { meal: 'Breakfast',     time: '7 – 9 am',    pct: 0.25, foods: 'Oats with fruit and nuts, or eggs with toast' },
    { meal: 'Mid-morning',   time: '10 – 11 am',  pct: 0.10, foods: 'Fruit, yoghurt, or a small handful of nuts' },
    { meal: 'Lunch',         time: '12 – 2 pm',   pct: 0.35, foods: 'Rice / roti with dal, sabzi, and salad' },
    { meal: 'Evening snack', time: '4 – 6 pm',    pct: 0.10, foods: 'Tea with a light snack — roasted chana or fruit' },
    { meal: 'Dinner',        time: '7 – 9 pm',    pct: 0.20, foods: 'Grilled protein, vegetables, and a small portion of carbs' },
  ];

  const ad = StyleSheet.create({
    card:         { backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, padding: 28, paddingHorizontal: 32, paddingLeft: 38, position: 'relative', overflow: 'hidden' },
    goldStrip:    { position: 'absolute', top: 0, left: 0, width: 3, bottom: 0, backgroundColor: accentColor },
    label:        { fontSize: 9, color: accentColor, letterSpacing: 8, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 6 },
    title:        { fontFamily: F.display, fontSize: 22, color: mc.text, letterSpacing: 1, marginBottom: 16 },
    insight:      { fontSize: 15, color: mc.text, lineHeight: 26, marginBottom: 20, letterSpacing: 0.5, fontFamily: F.mono },
    stats:        { flexDirection: 'row', flexWrap: 'wrap', gap: 32, borderTopWidth: 1, borderTopColor: mc.border, paddingTop: 16 },
    stat:         { gap: 3 },
    statLabel:    { fontSize: 10, color: mc.text3, letterSpacing: 4, textTransform: 'uppercase', fontFamily: F.mono },
    statVal:      { fontFamily: F.display, fontSize: 18, color: mc.text },
    badge:        { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, marginTop: 4 },
    calStrip:     { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: mc.border, flexWrap: 'wrap' },
    calLabel:     { fontSize: 10, color: mc.text3, letterSpacing: 4, textTransform: 'uppercase', fontFamily: F.mono },
    calInput:     { backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: mc.border, color: mc.text, fontFamily: F.display, fontSize: 18, width: 90, paddingVertical: 4, outlineWidth: 0 },
    calBtn:       { marginLeft: 'auto', paddingVertical: 7, paddingHorizontal: 18, backgroundColor: accentColor },
    calBtnTxt:    { color: '#060606', fontFamily: F.mono, fontSize: 11, letterSpacing: 2.5, fontWeight: '700' },
    mealPlan:     { marginTop: 24, borderTopWidth: 1, borderTopColor: mc.border, paddingTop: 20 },
    mealPlanLabel:{ fontSize: 9, color: accentColor, letterSpacing: 8, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 14 },
    th:           { fontSize: 9, color: mc.text3, letterSpacing: 4, textTransform: 'uppercase', fontFamily: F.mono },
    tableRow:     { flexDirection: 'row', paddingVertical: 14, gap: 12 },
    mealName:     { fontFamily: F.display, fontSize: 15, color: mc.text, letterSpacing: 1 },
    mealTime:     { fontSize: 10, color: mc.text3, marginTop: 2, letterSpacing: 2, fontFamily: F.mono },
    mealFoods:    { fontSize: fontSize, color: mc.text2, fontFamily: F.mono },
    mealKcal:     { fontFamily: F.display, fontSize: 17, color: mc.text },
  });

  return (
    <View style={ad.card}>
      {/* Gold left strip */}
      <View style={ad.goldStrip} />
      <Text style={ad.label}>TG·Adapt — Intelligent Plan Adaptation</Text>
      <Text style={ad.title}>Weekly Analysis</Text>
      <Text style={ad.insight}>{insight}</Text>

      {/* Stats row */}
      <View style={ad.stats}>
        {[
          { lbl: 'Avg Daily Calories', val: stats.avgCal ? `${stats.avgCal} kcal` : '—' },
          { lbl: 'Weight Change',      val: stats.wtChange !== null ? `${Number(stats.wtChange) > 0 ? '+' : ''}${stats.wtChange} kg` : '—' },
          { lbl: 'Daily Target',       val: tgt ? `${tgt} kcal` : '—' },
          { lbl: 'Status',             badge: badgeLabel },
        ].map((s, i) => (
          <View key={i} style={ad.stat}>
            <Text style={ad.statLabel}>{s.lbl}</Text>
            {s.badge ? (
              <View style={[ad.badge, { backgroundColor: bc.bg, borderColor: bc.border }]}>
                <Text style={{ fontSize: 10, letterSpacing: 3.5, textTransform: 'uppercase', fontFamily: F.mono, color: bc.text }}>{s.badge}</Text>
              </View>
            ) : (
              <Text style={ad.statVal}>{s.val}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Calorie target input */}
      <View style={ad.calStrip}>
        <Text style={ad.calLabel}>Daily calorie target</Text>
        <TextInput
          style={ad.calInput}
          value={target}
          onChangeText={setTarget}
          keyboardType="number-pad"
          placeholder="2000"
          placeholderTextColor={mc.text3}
        />
        <Text style={{ fontSize: 11, color: mc.text3, fontFamily: F.mono }}>kcal / day</Text>
        <TouchableOpacity style={ad.calBtn} onPress={saveTarget}>
          <Text style={ad.calBtnTxt}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Meal plan table */}
      {tgt > 0 && (
        <View style={ad.mealPlan}>
          <Text style={ad.mealPlanLabel}>Today's Meal Plan</Text>
          {/* Header row */}
          <View style={[ad.tableRow, { borderBottomWidth: 1, borderBottomColor: mc.border, paddingBottom: 10, paddingTop: 0 }]}>
            <Text style={[ad.th, { width: 110 }]}>Meal</Text>
            <Text style={[ad.th, { flex: 1 }]}>What to eat</Text>
            <Text style={[ad.th, { textAlign: 'right', width: 90 }]}>Kcal / Macros</Text>
          </View>
          {MEAL_PLAN.map((m, i) => (
            <View key={m.meal} style={[ad.tableRow, i < MEAL_PLAN.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }]}>
              <View style={{ width: 110 }}>
                <Text style={ad.mealName}>{m.meal}</Text>
                <Text style={ad.mealTime}>{m.time}</Text>
              </View>
              <Text style={[ad.mealFoods, { flex: 1, lineHeight: 20 }]}>{m.foods}</Text>
              <Text style={[ad.mealKcal, { width: 90, textAlign: 'right' }]}>{Math.round(tgt * m.pct)}</Text>
            </View>
          ))}
          {/* Total row */}
          <View style={[ad.tableRow, { borderTopWidth: 1, borderTopColor: mc.border, paddingTop: 12 }]}>
            <View style={{ width: 110 }}>
              <Text style={ad.mealName}>Total</Text>
            </View>
            <Text style={[ad.mealFoods, { flex: 1 }]}></Text>
            <Text style={[ad.mealKcal, { width: 90, textAlign: 'right' }]}>{tgt}</Text>
          </View>
        </View>
      )}
    </View>
  );
}


// ─────────────────────────────────────────────────────────────
//  WEEK CALENDAR  (matches .cal-grid in index.html)
// ─────────────────────────────────────────────────────────────
function WeekCalendar({ navigate, mc, accentColor, fontSize, borderRadius }) {
  const [weekOffset, setWeekOffset] = useState(0);

  function getWeekDays(offset) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1 + offset * 7); // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }

  const days = getWeekDays(weekOffset);
  const todayISO2 = new Date().toISOString().slice(0, 10);
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekLabel = `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const cal = StyleSheet.create({
    nav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    arrow:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: mc.border, paddingVertical: 5, paddingHorizontal: 12, borderRadius: borderRadius },
    arrowTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text2, letterSpacing: 1.5 },
    weekLabel: { fontFamily: F.mono, fontSize: 11, color: mc.text2, letterSpacing: 2.5, textTransform: 'uppercase' },
    penBtn:    { borderWidth: 1, borderColor: mc.border, padding: 5, borderRadius: borderRadius, alignItems: 'center', justifyContent: 'center' },
    grid:      { flexDirection: 'row', gap: 8 },
    day:       { flex: 1, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, borderRadius: borderRadius, padding: 14, paddingHorizontal: 10, minHeight: 148, gap: 6 },
    dayToday:  { borderColor: accentColor, shadowColor: accentColor, shadowOpacity: 0.15, shadowRadius: 2 },
    dayName:   { fontFamily: F.mono, fontSize: 8, letterSpacing: 4.5, textTransform: 'uppercase', color: mc.text3 },
    dateNum:   { fontFamily: F.display, fontSize: 22, color: mc.text, lineHeight: 26 },
    todayDot:  { width: 5, height: 5, borderRadius: 2.5, backgroundColor: accentColor },
  });

  return (
    <View>
      {/* .cal-nav */}
      <View style={cal.nav}>
        <TouchableOpacity style={cal.arrow} onPress={() => setWeekOffset(w => w - 1)}>
          <Text style={cal.arrowTxt}>← prev</Text>
        </TouchableOpacity>
        <Text style={cal.weekLabel}>{weekLabel.toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity style={cal.arrow} onPress={() => setWeekOffset(w => w + 1)}>
            <Text style={cal.arrowTxt}>next →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={cal.penBtn} onPress={() => navigate && navigate('schedule')}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={mc.text3} strokeWidth={2} strokeLinecap="round">
              <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </Svg>
          </TouchableOpacity>
        </View>
      </View>
      {/* .cal-grid */}
      <View style={cal.grid}>
        {days.map((d, i) => {
          const iso = d.toISOString().slice(0, 10);
          const isToday = iso === todayISO2;
          return (
            <View key={i} style={[cal.day, isToday && cal.dayToday]}>
              <Text style={cal.dayName}>{DAYS[i]}</Text>
              <Text style={cal.dateNum}>{d.getDate()}</Text>
              {isToday && <View style={cal.todayDot} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}


// ─────────────────────────────────────────────────────────────
//  CHARTS  (matches .charts-row in index.html)
//  Uses View-based bars (no chart libraries)
// ─────────────────────────────────────────────────────────────
function TrendsCharts({ username, mc, accentColor, fontSize, borderRadius }) {
  const [weightData, setWeightData] = useState([]);
  const [calData,    setCalData]    = useState([]);
  const [target,     setTarget]     = useState(0);

  useEffect(() => {
    if (!username) return;
    const lk = `toogood_daily_logs_${username}`;
    const pk = `toogood_user_plan_${username}`;

    async function loadData() {
      try {
        const [[, rawLogs], [, rawPlan]] = await AsyncStorage.multiGet([lk, pk]);
        let logs = rawLogs ? JSON.parse(rawLogs) : [];
        const plan = rawPlan ? JSON.parse(rawPlan) : {};
        if (plan.target_calories) setTarget(plan.target_calories);

        // Pull weight entries logged on the website and merge them in
        try {
          const serverData = await fetchLogs();
          if (serverData?.ok && serverData.logs?.length) {
            const serverMap = {};
            serverData.logs.forEach(l => { serverMap[l.date] = l; });
            const localMap = {};
            logs.forEach(l => { localMap[l.date] = l; });
            // Local takes precedence so app edits are not overwritten
            const merged = Object.values({ ...serverMap, ...localMap });
            merged.sort((a, b) => b.date.localeCompare(a.date));
            await AsyncStorage.setItem(lk, JSON.stringify(merged));
            logs = merged;
          }
        } catch {}

        const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));

        // Weight: last 14 days (wider window so website entries appear)
        const cutoff14 = new Date(); cutoff14.setDate(cutoff14.getDate() - 14);
        const wt = sorted
          .filter(l => new Date(l.date + 'T00:00') >= cutoff14)
          .filter(l => {
            const w = parseFloat(l.weight ?? l.weight_kg);
            return !isNaN(w) && w > 0;
          })
          .slice(-14)
          .map(l => ({ date: l.date, val: parseFloat(l.weight ?? l.weight_kg) }));

        // Calories: last 7 days
        const cutoff7 = new Date(); cutoff7.setDate(cutoff7.getDate() - 7);
        const cal = sorted
          .filter(l => new Date(l.date + 'T00:00') >= cutoff7 && l.calories > 0)
          .map(l => ({ date: l.date, val: l.calories }));

        setWeightData(wt);
        setCalData(cal);
      } catch {}
    }

    loadData();
  }, [username]);

  function BarChart({ data, maxVal, color, noDataText }) {
    if (!data.length) {
      return <Text style={ch.noData}>{noDataText}</Text>;
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 4 }}>
        {data.map((d, i) => {
          const pct = maxVal > 0 ? Math.min(1, d.val / maxVal) : 0;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end' }}>
                <View style={{ height: `${Math.max(4, pct * 100)}%`, backgroundColor: color, borderRadius: 2 }} />
              </View>
              <Text style={ch.barLabel}>
                {new Date(d.date + 'T00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' }).replace(' ', '\n')}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  // Weight summary stats
  const currentWeight = weightData.length ? weightData[weightData.length - 1].val : null;
  const firstWeight   = weightData.length > 1 ? weightData[0].val : null;
  const weightDelta   = (currentWeight !== null && firstWeight !== null) ? (currentWeight - firstWeight).toFixed(1) : null;

  const maxWeight = weightData.length ? Math.max(...weightData.map(d => d.val)) * 1.05 : 100;
  const minWeight = weightData.length ? Math.min(...weightData.map(d => d.val)) * 0.97 : 0;
  // Use range-relative bars so small weight changes are visible
  const weightRange = maxWeight - minWeight || 1;

  function WeightBarChart({ data }) {
    if (!data.length) {
      return <Text style={ch.noData}>Start logging your weight in the daily log to see trends here.</Text>;
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 4 }}>
        {data.map((d, i) => {
          const pct = (d.val - minWeight) / weightRange;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end' }}>
                <View style={{ height: `${Math.max(6, pct * 100)}%`, backgroundColor: accentColor, borderRadius: 2, opacity: i === data.length - 1 ? 1 : 0.6 }} />
              </View>
              <Text style={ch.barLabel}>
                {new Date(d.date + 'T00:00').getDate()}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  const maxCal = Math.max(target * 1.3 || 2600, ...calData.map(d => d.val), 100);

  const ch = StyleSheet.create({
    row:        { flexDirection: 'row', gap: 20 },
    card:       { flex: 1, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, padding: 22, paddingHorizontal: 24 },
    title:      { fontSize: 11, color: mc.text3, letterSpacing: 5, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 16 },
    noData:     { fontSize: Math.max(10, fontSize - 2), color: mc.text3, fontStyle: 'italic', paddingVertical: 20, textAlign: 'center', fontFamily: F.mono },
    barLabel:   { fontSize: 9, color: mc.text3, fontFamily: F.mono, letterSpacing: 1.5, textAlign: 'center' },
    currentVal: { fontFamily: F.display, fontSize: 22, color: accentColor, letterSpacing: 1 },
    delta:      { fontSize: 11, fontFamily: F.mono, letterSpacing: 1 },
    legend:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
    legItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legLine:  { width: 18, height: 1, backgroundColor: accentColor },
    legDashed:{ width: 18, height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: mc.text3 },
    legTxt:   { fontSize: 10, color: mc.text3, fontFamily: F.mono },
  });

  return (
    <View style={ch.row}>
      {/* Weight chart */}
      <View style={ch.card}>
        <Text style={ch.title}>Weight Trend (kg) — last 14 days</Text>
        {/* Current weight + delta summary */}
        {currentWeight !== null && (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
            <Text style={ch.currentVal}>{currentWeight} kg</Text>
            {weightDelta !== null && (
              <Text style={[ch.delta, { color: Number(weightDelta) <= 0 ? C.green : C.red }]}>
                {Number(weightDelta) > 0 ? '+' : ''}{weightDelta} kg over {weightData.length} entries
              </Text>
            )}
          </View>
        )}
        <WeightBarChart data={weightData} />
        <View style={ch.legend}>
          <View style={ch.legItem}>
            <View style={ch.legLine} />
            <Text style={ch.legTxt}>Weight (brightest = most recent)</Text>
          </View>
        </View>
      </View>
      {/* Calories chart */}
      <View style={ch.card}>
        <Text style={ch.title}>Daily Calories (kcal)</Text>
        <BarChart data={calData} maxVal={maxCal} color={accentColor} noDataText="No calorie data yet." />
        <View style={ch.legend}>
          <View style={ch.legItem}>
            <View style={ch.legLine} />
            <Text style={ch.legTxt}>Calories</Text>
          </View>
          {target > 0 && (
            <View style={ch.legItem}>
              <View style={ch.legDashed} />
              <Text style={ch.legTxt}>Target</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}


// ─────────────────────────────────────────────────────────────
//  PROGRESS GRID  (matches .progress-grid in index.html)
// ─────────────────────────────────────────────────────────────
function ProgressGrid({ username, mc, accentColor, fontSize, borderRadius }) {
  const [data, setData] = useState({ streak: 0, daysLogged: 0, missed: 0, avgSteps: null });

  useEffect(() => {
    if (!username) return;
    AsyncStorage.getItem(`toogood_daily_logs_${username}`).then(raw => {
      if (!raw) return;
      const logs = JSON.parse(raw);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthLogs = logs.filter(l => new Date(l.date + 'T00:00') >= monthStart);
      const daysLogged = monthLogs.length;
      const missed = Math.max(0, now.getDate() - daysLogged);
      let streak = 0;
      const d = new Date();
      while (true) {
        const iso = d.toISOString().slice(0, 10);
        if (logs.find(l => l.date === iso)) { streak++; d.setDate(d.getDate() - 1); } else break;
      }
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
      const stepLogs = logs.filter(l => new Date(l.date + 'T00:00') >= cutoff && l.steps);
      const avgSteps = stepLogs.length ? Math.round(stepLogs.reduce((s, l) => s + parseInt(l.steps), 0) / stepLogs.length) : null;
      setData({ streak, daysLogged, missed, avgSteps });
    });
  }, [username]);

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const cards = [
    { label: 'Logging Streak', val: data.streak,           sub: 'consecutive days', pct: Math.min(1, data.streak / 30),             color: C.green },
    { label: 'Days Logged',    val: data.daysLogged,       sub: 'this month',       pct: data.daysLogged / daysInMonth,              color: accentColor  },
    { label: 'Missed Days',    val: data.missed,           sub: 'this month',       pct: Math.min(1, data.missed / daysInMonth),     color: C.red   },
    { label: 'Avg Steps',      val: data.avgSteps ?? '—', sub: 'last 7 days',      pct: data.avgSteps ? Math.min(1, data.avgSteps / 10000) : 0, color: accentColor },
  ];

  const pg = StyleSheet.create({
    grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    card:    { flex: 1, minWidth: 140, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, padding: 18, paddingHorizontal: 20 },
    label:   { fontSize: 10, color: mc.text3, letterSpacing: 4.5, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 8 },
    val:     { fontFamily: F.display, fontSize: 26, color: mc.text, letterSpacing: 0.5, marginBottom: 6 },
    sub:     { fontSize: 11, color: mc.text2, fontFamily: F.mono, letterSpacing: 1 },
    barWrap: { marginTop: 10, height: 2, backgroundColor: mc.border, overflow: 'hidden' },
    barFill: { height: 2 },
  });

  return (
    <View style={pg.grid}>
      {cards.map((c, i) => (
        <View key={i} style={pg.card}>
          <Text style={pg.label}>{c.label}</Text>
          <Text style={pg.val}>{c.val}</Text>
          <Text style={pg.sub}>{c.sub}</Text>
          <View style={pg.barWrap}>
            <View style={[pg.barFill, { width: `${(c.pct * 100).toFixed(0)}%`, backgroundColor: c.color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}


// ─────────────────────────────────────────────────────────────
//  QUICK ACTIONS  (matches .actions-grid in index.html)
// ─────────────────────────────────────────────────────────────
function QuickActions({ navigate, onScan, mc, accentColor, fontSize, borderRadius }) {
  const actions = [
    {
      name: 'Meal Plan',
      desc: 'Generate a personalised plan for today or this week.',
      key: 'ai',
      icon: (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth={1.8} strokeLinecap="round">
          <Path d="M3 11l19-9-9 19-2-8-8-2z" />
        </Svg>
      ),
    },
    {
      name: 'Diet Analysis',
      desc: 'Let AI review what you ate and spot any gaps.',
      key: 'ai',
      icon: (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth={1.8} strokeLinecap="round">
          <Circle cx="11" cy="11" r="8" />
          <Line x1="21" y1="21" x2="16.65" y2="16.65" />
        </Svg>
      ),
    },
    {
      name: 'Scan Barcode',
      desc: 'Instantly look up nutrition on any packaged food.',
      key: 'scan',
      icon: (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth={1.8} strokeLinecap="round">
          <Rect x="1" y="4" width="22" height="16" />
          <Line x1="1" y1="10" x2="23" y2="10" />
          <Line x1="1" y1="14" x2="23" y2="14" />
          <Line x1="6" y1="4" x2="6" y2="20" />
          <Line x1="10" y1="4" x2="10" y2="20" />
          <Line x1="16" y1="4" x2="16" y2="20" />
        </Svg>
      ),
    },
    {
      name: 'Nutrient Check',
      desc: 'Find out which micronutrients you may be missing.',
      key: 'ai',
      icon: (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth={1.8} strokeLinecap="round">
          <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </Svg>
      ),
    },
  ];

  const qa = StyleSheet.create({
    grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    card:    { flex: 1, minWidth: 140, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, padding: 20, paddingHorizontal: 18 },
    iconBox: { width: 28, height: 28, borderWidth: 1, borderColor: mc.border, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    name:    { fontSize: fontSize, color: mc.text, fontFamily: F.mono, letterSpacing: 1, marginBottom: 4 },
    desc:    { fontSize: 11, color: mc.text2, fontFamily: F.mono, letterSpacing: 0.5, lineHeight: 18 },
  });

  return (
    <View style={qa.grid}>
      {actions.map((a, i) => (
        <TouchableOpacity key={i} style={qa.card} onPress={() => a.key === 'scan' ? onScan && onScan() : navigate(a.key)}>
          <View style={qa.iconBox}>{a.icon}</View>
          <Text style={qa.name}>{a.name}</Text>
          <Text style={qa.desc}>{a.desc}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  RECENT CHATS  (matches .chats-list in index.html)
// ─────────────────────────────────────────────────────────────
function RecentChats({ navigate, mc, accentColor, fontSize, borderRadius }) {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem('tg_ai_history').then(raw => {
      if (!raw) return;
      const msgs = JSON.parse(raw);
      const userMsgs = msgs.filter(m => m.role === 'user').slice(-4).reverse();
      setChats(userMsgs);
    });
  }, []);

  const rc = StyleSheet.create({
    list:    { gap: 1 },
    itemRow: { borderBottomWidth: 1, borderBottomColor: mc.border },
    item:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, flex: 1 },
    dot:     { width: 5, height: 5, backgroundColor: mc.borderH, flexShrink: 0 },
    title:   { fontSize: fontSize, color: mc.text, fontFamily: F.mono, letterSpacing: 0.5 },
    noChats: { fontSize: fontSize, color: mc.text2, fontStyle: 'italic', fontFamily: F.mono, paddingVertical: 16 },
  });

  if (chats.length === 0) {
    return <Text style={rc.noChats}>No conversations yet. Start by asking the AI something.</Text>;
  }

  return (
    <View style={rc.list}>
      {chats.map((m, i) => (
        <View key={i} style={rc.itemRow}>
          <TouchableOpacity style={rc.item} onPress={() => navigate('ai')}>
            <View style={rc.dot} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={rc.title} numberOfLines={1}>{m.content}</Text>
            </View>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  WEATHER OVERLAY  (decorative particle animation)
// ─────────────────────────────────────────────────────────────
const SCREEN_WIDTH  = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

function WeatherOverlay({ condition }) {
  const [enabled, setEnabled] = useState(true);
  const anims    = useRef([]);
  const particles = useRef([]);

  useEffect(() => {
    AsyncStorage.getItem('toogood_weather_anim').then(val => {
      setEnabled(val !== 'off');
    }).catch(() => {});
  }, []);

  // Determine particle type from weather condition code
  const type =
    (condition === 'RIN' || condition === 'DRZ' || condition === 'SHW' || condition === 'THD') ? 'rain'
    : condition === 'SNW' ? 'snow'
    : (condition === 'FOG') ? 'fog'
    : null;

  // Number of particles per type
  const COUNT = type === 'rain' ? 15 : type === 'snow' ? 12 : 0;

  // Build Animated.Values and stable random geometry once per type change
  if (anims.current.length !== COUNT) {
    anims.current    = Array.from({ length: COUNT }, () => new Animated.Value(0));
    particles.current = anims.current.map((anim, i) => {
      const x    = (i / COUNT) * SCREEN_WIDTH + Math.random() * (SCREEN_WIDTH / COUNT);
      const size = type === 'rain'
        ? { w: 1.5, h: 12 }
        : { w: 5 + Math.random() * 3, h: 5 + Math.random() * 3 };
      return { anim, x, size };
    });
  }

  useEffect(() => {
    if (!enabled || !type || type === 'fog') return;

    const animations = anims.current.map(anim => {
      const duration = type === 'rain'
        ? 900 + Math.random() * 600
        : 3000 + Math.random() * 2000;
      const delay = Math.random() * duration;
      anim.setValue(-30 - Math.random() * 80);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: SCREEN_HEIGHT + 30,
            duration,
            useNativeDriver: true,
          }),
        ]),
      );
    });

    const master = Animated.parallel(animations);
    master.start();
    return () => master.stop();
  }, [enabled, type]);

  if (!enabled || !type) return null;

  if (type === 'fog') {
    return (
      <View
        pointerEvents="none"
        style={wo.fogLayer}
      />
    );
  }

  return (
    <View pointerEvents="none" style={wo.overlay}>
      {particles.current.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            wo.particle,
            {
              left:   p.x,
              width:  p.size.w,
              height: p.size.h,
              borderRadius: type === 'snow' ? p.size.w / 2 : 1,
              backgroundColor: type === 'rain' ? 'rgba(140,170,210,0.45)' : 'rgba(220,235,255,0.6)',
              transform: [{ translateY: p.anim }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const wo = StyleSheet.create({
  overlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 0 },
  particle: { position: 'absolute', top: 0 },
  fogLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(200,210,220,0.07)', zIndex: 0 },
});

// ─────────────────────────────────────────────────────────────
//  WEATHER CODES
// ─────────────────────────────────────────────────────────────
const WX_CODES = {
  0:  { c: 'CLR', l: 'Clear sky',      lN: 'Clear night' },
  1:  { c: 'CLR', l: 'Mainly clear',   lN: 'Mainly clear' },
  2:  { c: 'PTY', l: 'Partly cloudy' },
  3:  { c: 'OVC', l: 'Overcast' },
  45: { c: 'FOG', l: 'Foggy' },
  48: { c: 'FOG', l: 'Icy fog' },
  51: { c: 'DRZ', l: 'Light drizzle' },
  53: { c: 'DRZ', l: 'Drizzle' },
  61: { c: 'RIN', l: 'Light rain' },
  63: { c: 'RIN', l: 'Rain' },
  65: { c: 'RIN', l: 'Heavy rain' },
  71: { c: 'SNW', l: 'Light snow' },
  73: { c: 'SNW', l: 'Snow' },
  80: { c: 'SHW', l: 'Showers' },
  85: { c: 'SNW', l: 'Snow showers' },
  95: { c: 'THD', l: 'Thunderstorm' },
  99: { c: 'THD', l: 'Heavy thunderstorm' },
};
function wxLookup(code, isDay) {
  const w = WX_CODES[code] || WX_CODES[Math.floor(code / 10) * 10] || { c: '–', l: 'Unknown' };
  return { c: w.c, l: (isDay === 0 && w.lN) ? w.lN : w.l };
}

// ─────────────────────────────────────────────────────────────
//  MAIN DASHBOARD SCREEN
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  SCAN RESULT MODAL  (matches #barcodeModal .scan-result in index.html)
// ─────────────────────────────────────────────────────────────
function ScanResultModal({ visible, loading, product, error, added, onAdd, onClose, onRescan, mc, accentColor }) {
  const sm = StyleSheet.create({
    overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
    box:       { width: 420, maxWidth: '90%', backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, padding: 28 },
    name:      { fontFamily: F.display, fontSize: 18, color: mc.text, letterSpacing: 0.5, marginBottom: 4 },
    brand:     { fontSize: 12, color: mc.text3, fontFamily: F.mono, letterSpacing: 1, marginBottom: 18 },
    macroRow:  { flexDirection: 'row', gap: 18, marginBottom: 14 },
    macroVal:  { fontFamily: F.display, fontSize: 18, color: accentColor },
    macroLbl:  { fontSize: 9, color: mc.text3, fontFamily: F.mono, letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 },
    serving:   { fontSize: 11, color: mc.text3, fontFamily: F.mono, letterSpacing: 0.5, marginBottom: 22 },
    actions:   { flexDirection: 'row', gap: 10 },
    addBtn:    { flex: 1, paddingVertical: 11, backgroundColor: accentColor, alignItems: 'center' },
    addBtnTxt: { fontFamily: F.mono, fontSize: 11, color: '#060606', fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
    closeBtn:  { paddingVertical: 11, paddingHorizontal: 18, borderWidth: 1, borderColor: mc.border, alignItems: 'center' },
    closeBtnTxt:{ fontFamily: F.mono, fontSize: 11, color: mc.text2, letterSpacing: 2, textTransform: 'uppercase' },
    msg:       { fontSize: 13, color: mc.text2, fontFamily: F.mono, textAlign: 'center', marginVertical: 24, lineHeight: 20 },
    doneMsg:   { fontSize: 13, color: '#4CAF7C', fontFamily: F.mono, letterSpacing: 0.5 },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sm.overlay}>
        <View style={sm.box}>
          {loading && (
            <>
              <ActivityIndicator color={accentColor} size="large" />
              <Text style={sm.msg}>Looking up product…</Text>
            </>
          )}

          {!loading && error && (
            <>
              <Text style={sm.msg}>{error}</Text>
              <View style={sm.actions}>
                <TouchableOpacity style={sm.addBtn} onPress={onRescan}><Text style={sm.addBtnTxt}>Try again</Text></TouchableOpacity>
                <TouchableOpacity style={sm.closeBtn} onPress={onClose}><Text style={sm.closeBtnTxt}>Close</Text></TouchableOpacity>
              </View>
            </>
          )}

          {!loading && !error && product && !added && (
            <>
              <Text style={sm.name}>{product.name}</Text>
              {!!product.brand && <Text style={sm.brand}>{product.brand}</Text>}
              <View style={sm.macroRow}>
                <View><Text style={sm.macroVal}>{product.calories}</Text><Text style={sm.macroLbl}>Kcal</Text></View>
                <View><Text style={sm.macroVal}>{product.protein}g</Text><Text style={sm.macroLbl}>Protein</Text></View>
                <View><Text style={sm.macroVal}>{product.carbs}g</Text><Text style={sm.macroLbl}>Carbs</Text></View>
                <View><Text style={sm.macroVal}>{product.fat}g</Text><Text style={sm.macroLbl}>Fat</Text></View>
              </View>
              <Text style={sm.serving}>Serving size: {product.serving} — values shown per 100g</Text>
              <View style={sm.actions}>
                <TouchableOpacity style={sm.addBtn} onPress={onAdd}><Text style={sm.addBtnTxt}>Add to Today's Log</Text></TouchableOpacity>
                <TouchableOpacity style={sm.closeBtn} onPress={onClose}><Text style={sm.closeBtnTxt}>Close</Text></TouchableOpacity>
              </View>
            </>
          )}

          {!loading && added && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 24, justifyContent: 'center' }}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#4CAF7C" strokeWidth={2.5} strokeLinecap="round">
                  <Polyline points="20 6 9 17 4 12" />
                </Svg>
                <Text style={sm.doneMsg}>Added to today's log</Text>
              </View>
              <View style={sm.actions}>
                <TouchableOpacity style={sm.addBtn} onPress={onRescan}><Text style={sm.addBtnTxt}>Scan another</Text></TouchableOpacity>
                <TouchableOpacity style={sm.closeBtn} onPress={onClose}><Text style={sm.closeBtnTxt}>Close</Text></TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function DashboardScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius, weatherEffects } = useTheme();
  const [user,     setUser]     = useState('');
  const [fullName, setFullName] = useState('');
  const [level,    setLevel]    = useState(null);
  const [xpPct,    setXpPct]    = useState(0);
  const [levelSub, setLevelSub] = useState('');
  const [myRank,   setMyRank]   = useState(null);
  const [wx,       setWx]       = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [todayItems,  setTodayItems]  = useState([]);
  const [coachItems,  setCoachItems]  = useState([]);
  const [heroStats,   setHeroStats]   = useState(null); // { kcal, target, protein, steps }

  // Scan Barcode (matches website's openBarcodeScanner — opens right here, no navigation)
  const [showScanner, setShowScanner] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanProduct, setScanProduct] = useState(null);
  const [scanError,   setScanError]   = useState('');
  const [scanAdded,   setScanAdded]   = useState(false);
  const [logRefresh,  setLogRefresh]  = useState(0);

  function openScanner() {
    setScanProduct(null);
    setScanError('');
    setScanAdded(false);
    setShowScanner(true);
  }

  async function handleScanned(code) {
    setShowScanner(false);
    setScanLoading(true);
    setScanError('');
    try {
      const p = await lookupBarcode(code);
      setScanProduct(p);
    } catch {
      setScanError('Could not find that product. Try another barcode.');
    } finally {
      setScanLoading(false);
    }
  }

  async function addScannedToLog() {
    if (!scanProduct || !user) return;
    const key = `toogood_daily_logs_${user}`;
    const raw = await AsyncStorage.getItem(key);
    const logs = raw ? JSON.parse(raw) : [];
    const idx = logs.findIndex(l => l.date === todayISO());
    const food = {
      name:     scanProduct.brand ? `${scanProduct.name} (${scanProduct.brand})` : scanProduct.name,
      serving:  scanProduct.serving,
      calories: scanProduct.calories,
      protein:  scanProduct.protein,
      carbs:    scanProduct.carbs,
      fat:      scanProduct.fat,
      fiber:     scanProduct.fiber,
      sugar:     scanProduct.sugar,
      sodium:    scanProduct.sodium,
      vitA:      scanProduct.vitA,
      vitC:      scanProduct.vitC,
      vitD:      scanProduct.vitD,
      vitB12:    scanProduct.vitB12,
      iron:      scanProduct.iron,
      calcium:   scanProduct.calcium,
      potassium: scanProduct.potassium,
      magnesium: scanProduct.magnesium,
      zinc:      scanProduct.zinc,
    };
    let entry = idx >= 0 ? logs[idx] : { date: todayISO(), weight: '', steps: '', workout: '', hunger: 5, energy: 5, foods: [], calories: 0, protein: 0, carbs: 0, fat: 0 };
    entry = { ...entry, foods: [...(entry.foods || []), food] };
    entry.calories = entry.foods.reduce((s, f) => s + (f.calories || 0), 0);
    entry.saved = true;
    if (idx >= 0) logs[idx] = entry; else logs.unshift(entry);
    await AsyncStorage.setItem(key, JSON.stringify(logs));
    syncLogs([entry]).catch(() => {});
    awardXP('food_log').catch(() => {});
    setScanAdded(true);
    setLogRefresh(r => r + 1);
  }

  useEffect(() => {
    // Award login XP and fetch score
    awardXP('login').catch(() => {});

    getUser().then(async u => {
      if (!u) return;
      setUser(u);
      // Load hero stats: today's kcal + target
      try {
        const todayISO = new Date().toISOString().slice(0, 10);
        const [rawLog, rawTarget] = await Promise.all([
          AsyncStorage.getItem(`toogood_daily_logs_${u}`),
          AsyncStorage.getItem(`tg_computed_targets_${u}`),
        ]);
        const logs = rawLog ? JSON.parse(rawLog) : [];
        const todayEntry = logs.find(l => l.date === todayISO);
        const kcal = (todayEntry?.foods || []).reduce((s, f) => s + (f.calories || 0), 0);
        const protein = (todayEntry?.foods || []).reduce((s, f) => s + (f.protein || 0), 0);
        const target = rawTarget ? JSON.parse(rawTarget) : null;
        setHeroStats({ kcal, protein: Math.round(protein), steps: parseInt(todayEntry?.steps) || 0, target });
      } catch {}
    });
    getMe().then(d => { if (d?.ok && d.full_name) setFullName(d.full_name); }).catch(() => {});

    getScore().then(d => {
      if (d?.ok) {
        setLevel(d.level);
        const pct = d.xp_per_level > 0 ? d.xp_in_level / d.xp_per_level : 0;
        setXpPct(Math.min(1, pct));
        const toNext = d.level < d.max_level
          ? `${(d.xp_per_level - d.xp_in_level).toLocaleString()} XP to next`
          : 'Max level!';
        setLevelSub(toNext);
        if (d.my_rank === 1) setMyRank(1);
      }
    }).catch(() => {}).finally(() => setLoading(false));

    // Weather
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        ()   => fetchWeatherByIP(),
        { timeout: 7000 },
      );
    } else {
      fetchWeatherByIP();
    }
  }, []);

  // Today's checklist — pulled from whatever's already configured (fasting window,
  // enabled reminders, scheduled workout) so it costs no new API calls.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const items = [];
      const todayDow = new Date().getDay(); // 0=Sun..6=Sat

      try {
        const raw = await AsyncStorage.getItem(`tg_fasting_${user}`);
        if (raw) {
          const d = JSON.parse(raw);
          if (d.fastStart && d.protocol) {
            items.push({
              key: 'fast',
              label: `Fasting — ${d.protocol.key || ''}`,
              sub: `Eating window opens ${new Date(d.fastStart + d.protocol.fast * 3600000).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`,
            });
          }
        }
      } catch {}

      try {
        const raw = await AsyncStorage.getItem(`tg_reminders2_${user}`);
        if (raw) {
          const d = JSON.parse(raw);
          (d.reminders || []).forEach(r => {
            if (r.enabled && (r.days || []).includes(todayDow)) {
              const sub = r.type === 'times' ? (r.times || []).join(', ') : `every ${r.interval}m`;
              items.push({ key: `rem-${r.key}`, label: r.label, sub });
            }
          });
        }
      } catch {}

      try {
        const raw = await AsyncStorage.getItem('exercise_schedule_v2');
        if (raw) {
          const d = JSON.parse(raw);
          const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          const dayName = DAYS_FULL[(todayDow + 6) % 7];
          const today = d.schedule?.[dayName];
          if (today?.active && (today.exercises || []).length) {
            today.exercises.forEach((ex, i) => {
              items.push({ key: `wo-${i}`, label: ex.name, sub: `${hToTimeStr(ex.startH)} – ${hToTimeStr(ex.endH)}` });
            });
          }
        }
      } catch {}

      // Gym program calendar blocks for today
      try {
        const todayISO = new Date().toISOString().slice(0, 10);
        const raw = await AsyncStorage.getItem(`tg_cal_blocks_${user}_${todayISO}`);
        if (raw) {
          const blocks = JSON.parse(raw);
          blocks.forEach(b => {
            const h = Math.floor(b.startH), m = Math.round((b.startH - h) * 60);
            const timeStr = `${h}:${m.toString().padStart(2, '0')}`;
            items.push({ key: `calblock-${b.id}`, label: b.name, sub: `${timeStr} · from your gym program` });
          });
        }
      } catch {}

      setTodayItems(items);
    })();
  }, [user]);

  // ── Proactive coach nudges ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const nudges = [];
      const now = Date.now();
      const todayDow = (new Date().getDay() + 6) % 7; // Mon=0..Sun=6

      // 1. Workout consistency: flag if mid-week with zero program days done
      try {
        const raw = await AsyncStorage.getItem(`tg_programs_${user}`);
        if (raw) {
          const { activeIds = [], progress = {} } = JSON.parse(raw);
          const { PROGRAMS: PROGS } = await import('../data/guidedWorkouts');
          for (const pid of activeIds) {
            const prog = PROGS.find(p => p.id === pid);
            if (!prog) continue;
            const progState = progress[pid] || { week: 1, completedDays: [] };
            const weekIdx = Math.min(progState.week - 1, prog.schedule.length - 1);
            const weekDays = prog.schedule[weekIdx].days.filter(d => !d.rest);
            const doneThisWeek = progState.completedDays.filter(k => k.startsWith(`${pid}_w${progState.week}_`)).length;
            if (todayDow >= 2 && doneThisWeek === 0 && weekDays.length > 0) {
              nudges.push({ key: `wo-${pid}`, label: `${prog.name} — no workouts logged yet this week`, sub: `${weekDays.length} session${weekDays.length > 1 ? 's' : ''} planned · tap Programs to check off today` });
            }
          }
        }
      } catch {}

      // 2. Fasting pattern: flag repeated early-ended fasts
      try {
        const raw = await AsyncStorage.getItem(`tg_fasting_${user}`);
        if (raw) {
          const d = JSON.parse(raw);
          const recentEarly = (d.history || []).filter(h => h.endedEarly && now - h.end < 7 * 86400000).length;
          if (recentEarly >= 2) {
            nudges.push({ key: 'fast-pattern', label: `${recentEarly} fasts ended early this week`, sub: 'Consider switching to a shorter window (e.g. 14:10) for better consistency' });
          }
        }
      } catch {}

      // 3. Cycle phase awareness
      try {
        const raw = await AsyncStorage.getItem(`tg_period_${user}`);
        if (raw) {
          const pd = JSON.parse(raw);
          if (pd.lastPeriod) {
            const { getCyclePhase } = await import('../lib/cyclePhase');
            const phase = getCyclePhase(pd);
            if (phase === 'luteal') {
              nudges.push({ key: 'cycle-luteal', label: 'Luteal phase — calorie targets adjusted +125 kcal', sub: 'Prioritise recovery workouts & stress relief · SmartTargets updated' });
            } else if (phase === 'menstruation') {
              nudges.push({ key: 'cycle-mens', label: 'Menstrual phase — rest & recovery recommended', sub: 'Iron-rich foods & gentle movement · targets unchanged' });
            } else if (phase === 'ovulation') {
              nudges.push({ key: 'cycle-ovul', label: 'Ovulation phase — peak performance window', sub: 'Great time to push intensity in your workouts' });
            }
          }
        }
      } catch {}

      // 4. Calorie progress vs SmartTargets goal (evening check)
      try {
        const hour = new Date().getHours();
        if (hour >= 17) {
          const tRaw = await AsyncStorage.getItem(`tg_computed_targets_${user}`);
          if (tRaw) {
            const t = JSON.parse(tRaw);
            const todayISO = new Date().toISOString().slice(0, 10);
            const lRaw = await AsyncStorage.getItem(`toogood_daily_logs_${user}`);
            const logs = lRaw ? JSON.parse(lRaw) : [];
            const todayLog = logs.find(l => l.date === todayISO);
            const logged = (todayLog?.foods || []).reduce((s, f) => s + (f.calories || 0), 0);
            const pct = t.calories > 0 ? (logged / t.calories) * 100 : 0;
            if (pct < 50) {
              nudges.push({ key: 'cal-under', label: `Only ${Math.round(pct)}% of your calorie goal logged today`, sub: `${logged} / ${t.calories} kcal — log your meals to stay on track` });
            } else if (pct > 115) {
              nudges.push({ key: 'cal-over', label: `${Math.round(pct - 100)}% over your calorie goal today`, sub: `${logged} / ${t.calories} kcal — consider a lighter dinner` });
            }
          }
        }
      } catch {}

      // 5. Workout completion vs today's calendar blocks
      try {
        const todayISO = new Date().toISOString().slice(0, 10);
        const bRaw = await AsyncStorage.getItem(`tg_cal_blocks_${user}_${todayISO}`);
        const pRaw = await AsyncStorage.getItem(`tg_programs_${user}`);
        if (bRaw && pRaw) {
          const blocks = JSON.parse(bRaw);
          const { activeIds = [], progress = {} } = JSON.parse(pRaw);
          const doneKeys = Object.values(progress).flatMap(p => p.completedDays || []);
          const unfinished = blocks.filter(b => b.programId && !doneKeys.some(k => k.includes(b.programId)));
          if (unfinished.length > 0 && new Date().getHours() >= 18) {
            nudges.push({ key: 'cal-undone', label: `${unfinished.length} scheduled workout${unfinished.length > 1 ? 's' : ''} not marked done today`, sub: `${unfinished.map(b => b.name).join(', ')} — tap Gym Programs to check off` });
          }
        }
      } catch {}

      setCoachItems(nudges);
    })();
  }, [user]);

  function fetchWeather(lat, lon) {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`)
      .then(r => r.json())
      .then(d => {
        if (d?.current_weather) {
          const cw = d.current_weather;
          const info = wxLookup(cw.weathercode, cw.is_day);
          setWx({ c: info.c, l: info.l, temp: Math.round(cw.temperature) });
        }
      }).catch(() => {});
  }

  function fetchWeatherByIP() {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(loc => {
        if (loc.latitude && loc.longitude) fetchWeather(loc.latitude, loc.longitude);
        else setWx({ c: '–', l: 'Allow location for weather', temp: null });
      }).catch(() => {});
  }

  const hour     = new Date().getHours();
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';
  const name     = fullName || (user ? user.split('@')[0] : '');

  function nav(s) {
    if (navigation?.navigate) navigation.navigate(s);
  }

  const st = StyleSheet.create({
    screen: { flex: 1, backgroundColor: mc.bg },

    // ── .hero ──
    hero:            { minHeight: 460, paddingHorizontal: 56, paddingTop: 48, paddingBottom: 40, borderBottomWidth: 1, borderBottomColor: mc.border, justifyContent: 'center', position: 'relative' },
    heroTop:         { position: 'absolute', top: 24, right: 28, flexDirection: 'row', alignItems: 'center', gap: 10 },
    scanBtn:         { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: mc.border },
    scanBtnTxt:      { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: mc.text2, letterSpacing: 2 },

    // World #1 banner
    worldOneBanner:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(201,168,76,0.08)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.5)' },
    worldOneText:    { fontFamily: F.mono, fontSize: 11, letterSpacing: 5.5, color: accentColor, textTransform: 'uppercase' },

    // .hero-eyebrow
    eyebrow:         { fontSize: 10, color: mc.text3, letterSpacing: 7, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 20 },

    // .hero-greeting
    greeting:        { fontFamily: F.display, fontWeight: '700', fontSize: 56, color: mc.text, letterSpacing: -0.5, lineHeight: 62, marginBottom: 24 },
    greetingName:    { fontFamily: "'Jim Nightshade', cursive", fontWeight: '400', color: accentColor },

    // Level badge — wide horizontal strip
    levelBadge:      { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 28, paddingVertical: 16, paddingHorizontal: 24, borderWidth: 1, borderColor: mc.border, backgroundColor: mc.goldDim, gap: 24 },
    levelLabel:      { fontFamily: F.mono, fontSize: 9, color: accentColor, letterSpacing: 7, textTransform: 'uppercase', marginBottom: 2 },
    levelNum:        { fontFamily: F.serif, fontSize: 48, color: accentColor, lineHeight: 52 },
    levelXpTrack:    { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
    levelXpFill:     { height: 3, backgroundColor: accentColor, borderRadius: 2 },
    levelSub:        { fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 1.5, marginTop: 4 },

    // .weather-widget
    wxWidget:        { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 52 },
    wxIconArea:      { flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 },
    wxIconBox:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    wxIconTxt:       { fontFamily: F.mono, fontSize: 10, color: accentColor, letterSpacing: 1 },
    wxCode:          { backgroundColor: accentColor, paddingHorizontal: 7, paddingVertical: 3 },
    wxCodeTxt:       { fontFamily: F.display, fontSize: 10, color: '#060606', letterSpacing: 3 },
    wxTemp:          { fontFamily: F.display, fontSize: 22, color: mc.text, letterSpacing: 1 },
    wxDesc:          { fontSize: Math.max(10, fontSize - 2), color: mc.text2, letterSpacing: 2, textTransform: 'uppercase', marginTop: 2, fontFamily: F.mono },
    wxDate:          { marginLeft: 'auto' },
    wxDateTxt:       { fontSize: Math.max(10, fontSize - 2), color: mc.text3, fontFamily: F.mono, textAlign: 'right', letterSpacing: 1.5, lineHeight: 18 },

    // .hero-actions / .hero-btn
    heroActions:     { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    heroBtn:         { paddingVertical: 11, paddingHorizontal: 24 },
    heroBtnPrimary:  { backgroundColor: accentColor, borderWidth: 1, borderColor: accentColor },
    heroBtnSecondary:{ backgroundColor: 'transparent', borderWidth: 1, borderColor: mc.border },
    heroBtnTxt:      { fontFamily: F.mono, fontSize: fontSize, letterSpacing: 2.5, color: mc.text2 },

    // .content
    content:       { paddingHorizontal: 56, paddingBottom: 80 },
    section:       { marginTop: 40 },
    sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 16 },
    sectionTitle:  { fontFamily: F.display, fontWeight: '700', fontSize: 18, color: mc.text, letterSpacing: 0.2 },
    sectionSub:    { fontSize: fontSize, color: mc.text2, fontStyle: 'italic', letterSpacing: 0.5, marginTop: 2, fontFamily: F.mono },
    sectionAction: { fontSize: Math.max(10, fontSize - 2), color: mc.text2, letterSpacing: 2, fontFamily: F.mono },

    // .today-checklist
    todayRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
    todayDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: accentColor, flexShrink: 0 },
    todayLabel:  { fontFamily: F.mono, fontSize: fontSize, color: mc.text, letterSpacing: 0.3 },
    todaySub:    { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: mc.text3, marginTop: 2, letterSpacing: 0.5 },
    todayEmpty:  { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: mc.text3, fontStyle: 'italic', paddingVertical: 8 },
  });

  return (
    <>
    <ScrollView style={st.screen} contentContainerStyle={{ paddingBottom: 80 }}>

      {/* ══ HERO — matches .hero (min-height:100vh) ══ */}
      <View style={st.hero}>

        {/* Weather particle overlay */}
        {weatherEffects !== false && <WeatherOverlay condition={wx?.c} />}

        {/* Scan Barcode button — .hero-top / .hero-scan-btn */}
        <View style={st.heroTop}>
          <TouchableOpacity style={st.scanBtn} onPress={openScanner}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth={1.8} strokeLinecap="round">
              <Rect x="1" y="4" width="22" height="16" />
              <Line x1="1" y1="10" x2="23" y2="10" />
              <Line x1="1" y1="14" x2="23" y2="14" />
              <Line x1="6" y1="4" x2="6" y2="20" />
              <Line x1="10" y1="4" x2="10" y2="20" />
              <Line x1="16" y1="4" x2="16" y2="20" />
            </Svg>
            <Text style={st.scanBtnTxt}>Scan Barcode</Text>
          </TouchableOpacity>
        </View>

        {/* World #1 banner (shown only when rank = 1) */}
        {myRank === 1 && (
          <TouchableOpacity style={st.worldOneBanner} onPress={() => nav('score')}>
            <Text style={st.worldOneText}>World Number One</Text>
          </TouchableOpacity>
        )}

        {/* .hero-eyebrow */}
        <Text style={st.eyebrow}>{todayStr().toUpperCase()}</Text>

        {/* .hero-greeting */}
        <View style={{ marginBottom: 24 }}>
          <Text style={[st.greeting, { marginBottom: 0 }]}>{greeting},</Text>
          {React.createElement('div', {
            style: {
              fontFamily: "'Jim Nightshade', cursive",
              fontSize: 56,
              color: accentColor,
              fontWeight: '400',
              letterSpacing: '-0.5px',
              lineHeight: '62px',
            }
          }, name + '.')}
        </View>

        {/* Level badge — wide horizontal strip */}
        {level !== null && (
          <TouchableOpacity style={st.levelBadge} onPress={() => nav('score')}>
            <View>
              <Text style={st.levelLabel}>Level</Text>
              <Text style={st.levelNum}>{level}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={st.levelXpTrack}>
                <View style={[st.levelXpFill, { width: `${(xpPct * 100).toFixed(1)}%` }]} />
              </View>
              <Text style={[st.levelSub, { marginTop: 6 }]}>{levelSub}</Text>
            </View>
          </TouchableOpacity>
        )}
        {loading && level === null && (
          <View style={st.levelBadge}>
            <View>
              <Text style={st.levelLabel}>Level</Text>
              <Text style={[st.levelNum, { color: mc.text3 }]}>—</Text>
            </View>
          </View>
        )}

        {/* .weather-widget */}
        <View style={st.wxWidget}>
          <View style={st.wxIconArea}>
            <View style={st.wxIconBox}>
              <Text style={st.wxIconTxt}>{wx ? wx.c : '–'}</Text>
            </View>
            <View style={st.wxCode}>
              <Text style={st.wxCodeTxt}>{wx?.c || '–'}</Text>
            </View>
          </View>
          <View>
            <Text style={st.wxTemp}>{wx?.temp != null ? `${wx.temp}°C` : '–'}</Text>
            <Text style={st.wxDesc}>{wx?.l || 'Fetching weather…'}</Text>
          </View>
          <View style={st.wxDate}>
            <Text style={st.wxDateTxt}>
              {new Date().toLocaleDateString('en', { weekday: 'long' })}{'\n'}
              {new Date().toLocaleDateString('en', { month: 'long', day: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Today's quick-stats strip */}
        {heroStats !== null && (
          <View style={{ flexDirection: 'row', gap: 1, marginBottom: 28, overflow: 'hidden' }}>
            {[
              { label: 'KCAL', value: heroStats.kcal > 0 ? heroStats.kcal.toLocaleString() : '—', sub: heroStats.target ? `/ ${heroStats.target.calories.toLocaleString()} goal` : 'eaten today', accent: heroStats.target && heroStats.kcal > heroStats.target.calories },
              { label: 'PROTEIN', value: heroStats.protein > 0 ? `${heroStats.protein}g` : '—', sub: heroStats.target ? `/ ${heroStats.target.protein}g target` : 'today' },
              { label: 'STEPS', value: heroStats.steps > 0 ? heroStats.steps.toLocaleString() : '—', sub: 'logged today' },
            ].map(s => (
              <View key={s.label} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: s.accent ? '#E57373' + '60' : mc.border, backgroundColor: s.accent ? '#E5737308' : 'transparent' }}>
                <Text style={{ fontFamily: F.mono, fontSize: 9, color: s.accent ? '#E57373' : mc.text3, letterSpacing: 3, marginBottom: 4 }}>{s.label}</Text>
                <Text style={{ fontFamily: F.display, fontSize: 22, color: s.accent ? '#E57373' : accentColor, letterSpacing: -0.5 }}>{s.value}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, marginTop: 2 }}>{s.sub}</Text>
              </View>
            ))}
            {heroStats.target && heroStats.kcal > 0 && (
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: mc.border }}>
                <View style={{ height: 2, width: `${Math.min(100, (heroStats.kcal / heroStats.target.calories) * 100).toFixed(1)}%`, backgroundColor: heroStats.kcal > heroStats.target.calories ? '#E57373' : accentColor }} />
              </View>
            )}
          </View>
        )}

        {/* .hero-actions */}
        <View style={st.heroActions}>
          <TouchableOpacity style={[st.heroBtn, st.heroBtnPrimary]} onPress={() => nav('ai')}>
            <Text style={[st.heroBtnTxt, { color: '#060606' }]}>Ask the AI</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.heroBtn, st.heroBtnSecondary]} onPress={() => nav('log')}>
            <Text style={st.heroBtnTxt}>Log Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.heroBtn, st.heroBtnSecondary]} onPress={() => nav('adapt')}>
            <Text style={st.heroBtnTxt}>My Adaptation</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ CONTENT ══ */}
      <View style={st.content}>

        {/* What's on today */}
        <View style={[st.section, { marginTop: 0 }]} id="today">
          <View style={st.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={st.sectionTitle}>Today</Text>
              <Text style={st.sectionSub}>What's on your plate today, from your reminders, fasting window and workout schedule.</Text>
            </View>
            <TouchableOpacity onPress={() => nav('reminders')}>
              <Text style={st.sectionAction}>Manage →</Text>
            </TouchableOpacity>
          </View>
          {todayItems.length === 0 ? (
            <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap', paddingVertical: 4 }}>
              <TouchableOpacity onPress={() => nav('programs')} style={{ paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: mc.border }}>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text2 }}>+ Start a gym program</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => nav('schedule')} style={{ paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: mc.border }}>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text2 }}>+ Set exercise schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => nav('fasting')} style={{ paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: mc.border }}>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text2 }}>+ Start fasting timer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            todayItems.map(it => (
              <View key={it.key} style={st.todayRow}>
                <View style={st.todayDot} />
                <View style={{ flex: 1 }}>
                  <Text style={st.todayLabel}>{it.label}</Text>
                  <Text style={st.todaySub}>{it.sub}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Coach Insights */}
        <View style={st.section} id="coach">
          <View style={st.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={st.sectionTitle}>Coach Insights</Text>
              <Text style={st.sectionSub}>Pattern-based nudges from your fasting, workouts and cycle data.</Text>
            </View>
          </View>
          {coachItems.length === 0 ? (
            <View style={[st.todayRow, { borderLeftWidth: 2, borderLeftColor: '#4CAF7C66', paddingLeft: 10 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.todayLabel, { color: '#4CAF7C' }]}>All looks good today</Text>
                <Text style={st.todaySub}>No patterns flagged — keep logging consistently for personalised nudges</Text>
              </View>
            </View>
          ) : (
            coachItems.map(it => (
              <View key={it.key} style={[st.todayRow, { borderLeftWidth: 2, borderLeftColor: accentColor + '66', paddingLeft: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={st.todayLabel}>{it.label}</Text>
                  <Text style={st.todaySub}>{it.sub}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Jump In — shortcut cards replacing embedded duplicates */}
        <View style={st.section} id="jumpin">
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>Jump In</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            {[
              { key: 'log',   label: 'Log Food',    sub: 'Track today\'s meals & calories',   arrow: '→' },
              { key: 'ai',    label: 'AI Assistant', sub: 'Ask anything, get a diet plan',     arrow: '→' },
              { key: 'adapt', label: 'My Plan',      sub: 'Your personalised weekly plan',     arrow: '→' },
              { key: 'diary', label: 'Workout Log',  sub: 'Record and review your sessions',   arrow: '→' },
            ].map(card => (
              <TouchableOpacity
                key={card.key}
                onPress={() => nav(card.key)}
                style={{ flex: 1, minWidth: 160, borderWidth: 1, borderColor: mc.border, padding: 16, borderRadius }}
              >
                <Text style={{ fontFamily: F.display, fontWeight: '600', fontSize: 14, color: mc.text, marginBottom: 4 }}>{card.label}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, lineHeight: 16 }}>{card.sub}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor, marginTop: 14 }}>Open →</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Exercise Calendar */}
        <View style={st.section} id="calendar">
          <View style={st.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={st.sectionTitle}>Exercise Calendar</Text>
              <Text style={st.sectionSub}>Your weekly workout plan — auto-updates when you change your exercise schedule.</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => nav('calendar')}>
                <Text style={st.sectionAction}>Full view →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => nav('settings')}>
                <Text style={[st.sectionAction, { whiteSpace: 'nowrap' }]}>Edit schedule →</Text>
              </TouchableOpacity>
            </View>
          </View>
          <WeekCalendar navigate={nav} mc={mc} accentColor={accentColor} fontSize={fontSize} borderRadius={borderRadius} />
        </View>

        {/* Charts — Your Trends */}
        <View style={st.section} id="charts">
          <View style={st.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={st.sectionTitle}>Your Trends</Text>
              <Text style={st.sectionSub}>Weight: last 14 days (synced from your account) · Calories: last 7 days.</Text>
            </View>
          </View>
          <TrendsCharts username={user} mc={mc} accentColor={accentColor} fontSize={fontSize} borderRadius={borderRadius} />
        </View>

        {/* Progress Overview */}
        <View style={st.section} id="progress">
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>Progress Overview</Text>
          </View>
          <ProgressGrid username={user} mc={mc} accentColor={accentColor} fontSize={fontSize} borderRadius={borderRadius} />
        </View>


      </View>
    </ScrollView>

    <BarcodeScanner visible={showScanner} onScanned={handleScanned} onClose={() => setShowScanner(false)} />

    <ScanResultModal
      visible={scanLoading || !!scanProduct || !!scanError}
      loading={scanLoading}
      product={scanProduct}
      error={scanError}
      added={scanAdded}
      onAdd={addScannedToLog}
      onClose={() => { setScanProduct(null); setScanError(''); setScanAdded(false); }}
      onRescan={() => { setScanProduct(null); setScanError(''); setScanAdded(false); setShowScanner(true); }}
      mc={mc}
      accentColor={accentColor}
    />
    </>
  );
}

