import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Modal,
} from 'react-native';
import { C, F } from '../theme';
import { getMe, saveProfile, changeEmail } from '../api';
import { getUser, clearAuth, getToken } from '../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, ACCENT_MAP as ACCENT_MAP_FULL } from '../ThemeContext';
import { IS_ELECTRON, API_BASE } from '../config';
import * as local from '../localStore';

// Flat map of accent key -> hex color (for local self-theming display)
const ACCENT_MAP = Object.fromEntries(
  Object.entries(ACCENT_MAP_FULL).map(([k, v]) => [k, v.gold])
);
const ACCENT_NAME = {
  gold:'Gold', red:'Red', green:'Green', blue:'Blue', purple:'Purple', orange:'Orange', pink:'Pink', teal:'Teal',
};

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCSV(filename, header, rows) {
  if (typeof document === 'undefined') return;
  const csv = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Module-scope (not redefined every SettingsScreen render) so TextInput keeps
// focus across keystrokes — a component defined inside a render function gets
// a fresh identity each render, which forces React to remount the input.
function Lbl({ children }) {
  return <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.text3, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>{children}</Text>;
}
function Inp({ value, onChange, placeholder, secure, keyboard }) {
  const { fontSize } = useTheme();
  return (
    <TextInput
      style={{ backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.22)', color: C.text, fontFamily: F.mono, fontSize, paddingVertical: 8, marginBottom: 4, outlineWidth: 0 }}
      value={value} onChangeText={onChange}
      placeholder={placeholder || ''} placeholderTextColor={C.text3}
      secureTextEntry={!!secure} keyboardType={keyboard || 'default'}
    />
  );
}

function applyDomExtras(fontSize, corner, density) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--fs',      { xs:'10px', sm:'12px', md:'14px', lg:'16px', xl:'18px' }[fontSize] || '14px');
  root.style.setProperty('--radius',  { sharp:'0px', soft:'6px', rounded:'14px' }[corner] || '6px');
  root.style.setProperty('--msg-gap', { compact:'10px', comfortable:'18px', spacious:'28px' }[density] || '18px');
}

const FOOD_TAGS = [
  'Vegetarian','Vegan','Chicken','Red Meat','Seafood','Eggs','Rice','Bread / Wheat',
  'Lentils & Legumes','Dairy','Indian','Mediterranean','East Asian','Italian',
  'Low Carb','High Protein','Spicy','Sweet',
];
const GOALS     = [['fat_loss','Fat Loss'],['weight_gain','Gain Weight'],['muscle_gain','Muscle Gain'],['maintain','Maintain Weight'],['health','General Health'],['endurance','Build Endurance']];
const GENDERS   = [['male','Male'],['female','Female'],['other','Other'],['prefer_not','Prefer not to say']];
const ACTIVITY  = [['sedentary','Sedentary'],['light','Lightly Active'],['moderate','Moderately Active'],['active','Very Active'],['athlete','Athlete Level']];
const MOBILITY  = [['none','No Limitations'],['low_impact','Low-impact Preferred'],['joint','Joint / Mobility Issues'],['wheelchair','Wheelchair / Mobility Aid']];

const EX_CATS = [
  ['Cardio & Endurance', ['Running','Jogging','Walking','Cycling (road)','Cycling (indoor/spin)','Jump rope','Stair climbing','Elliptical','Treadmill','Rowing machine','Nordic walking']],
  ['Gym & Strength',     ['Weight training','Bodybuilding','Powerlifting','CrossFit','Kettlebells','Calisthenics','HIIT','Resistance bands','TRX','Functional training']],
  ['Swimming & Water',   ['Swimming','Open-water swimming','Water polo','Kayaking','Paddleboarding','Surfing','Rowing (boat)']],
  ['Martial Arts',       ['Boxing','Kickboxing','Judo','Karate','Taekwondo','MMA','BJJ','Wrestling','Muay Thai','Capoeira','Aikido']],
  ['Racquet & Court',    ['Tennis','Badminton','Squash','Table tennis','Pickleball','Racquetball']],
  ['Team Sports',        ['Football / Soccer','Basketball','Volleyball','Cricket','Baseball','Ice hockey','Rugby','Handball','Kabaddi','Netball']],
  ['Flexibility & Mind', ['Yoga','Pilates','Tai Chi','Stretching','Gymnastics','Barre','Aerial yoga']],
  ['Dance & Aerobics',   ['Zumba','Bollywood dance','Hip-hop dance','Salsa / Ballroom','Aerobics','Step aerobics']],
  ['Outdoor & Adventure',['Hiking','Rock climbing','Skiing','Snowboarding','Skateboarding','Mountain biking','Trail running']],
  ['Other Sports',       ['Golf','Archery','Fencing','Athletics / Track & field','Roller skating','Ice skating','Triathlon']],
];

const NAV_SECTIONS = [
  { id: 'appearance',  label: 'Appearance',        group: 'Preferences' },
  { id: 'profile',     label: 'Profile',           group: 'Preferences' },
  { id: 'family',      label: 'Family Role',       group: 'Preferences' },
  { id: 'food',        label: 'Food Preferences',  group: 'Preferences' },
  { id: 'exercise',    label: 'Exercise Schedule', group: 'Fitness' },
  { id: 'account',     label: 'Account & Security',group: 'Account' },
  { id: 'data',        label: 'Export Data',       group: 'Account' },
  { id: 'chats',       label: 'Hidden Chats',      group: 'Account' },
  { id: 'voice',       label: 'Coach Voice',       group: 'Coach' },
];

const FAMILY_ROLES = ['Father','Mother','Brother','Sister','Grandfather','Grandmother','Son','Daughter'];

export default function SettingsScreen({ navigation }) {
  const { setTheme, setExtras, fontSize, borderRadius, mode: ctxMode, accent: ctxAccent, weatherEffects: ctxWeather } = useTheme();
  const [activeSection, setActiveSection]   = useState('appearance');
  const [username,      setUsername]        = useState('');
  // Appearance — local state mirrors ThemeContext (for segment-control highlighting)
  const [appMode,       setAppMode]         = useState(ctxMode || 'dark');
  const [appFontSize,   setAppFontSize]     = useState(() => { if (fontSize === 10) return 'xs'; if (fontSize === 12) return 'sm'; if (fontSize === 16) return 'lg'; if (fontSize === 18) return 'xl'; return 'md'; });
  const [appCorner,     setAppCorner]       = useState(() => { if (borderRadius === 0) return 'sharp'; if (borderRadius === 14) return 'rounded'; return 'soft'; });
  const [appDensity,    setAppDensity]      = useState('comfortable'); // 'compact' | 'comfortable' | 'spacious'
  const [appSidebar,    setAppSidebar]      = useState('normal'); // 'narrow' | 'normal' | 'wide'
  const [appAnim,       setAppAnim]         = useState('normal'); // 'none' | 'normal' | 'snappy'
  const [appAccent,     setAppAccent]       = useState(ctxAccent || 'green');
  const [appWeather,    setAppWeather]      = useState(ctxWeather !== false);
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  // Context is the source of truth for mode/accent/fontSize/borderRadius/weather (loads
  // asynchronously per-username from AsyncStorage). Keep local preview state in sync with it
  // so Settings doesn't get stuck showing the pre-load defaults while other screens are correct.
  useEffect(() => {
    setAppMode(ctxMode || 'dark');
    setAppAccent(ctxAccent || 'green');
    setAppFontSize(fontSize === 10 ? 'xs' : fontSize === 12 ? 'sm' : fontSize === 16 ? 'lg' : fontSize === 18 ? 'xl' : 'md');
    setAppCorner(borderRadius === 0 ? 'sharp' : borderRadius === 14 ? 'rounded' : 'soft');
    setAppWeather(ctxWeather !== false);
    setAppearanceDirty(false);
  }, [ctxMode, ctxAccent, fontSize, borderRadius, ctxWeather]);

  // Expose the dirty flag so App.js can block navigating away from Settings entirely
  // (e.g. clicking a different item in the sidebar) while there are unsaved appearance changes.
  useEffect(() => {
    if (typeof window !== 'undefined') window.__tgAppearanceDirty = appearanceDirty;
    return () => { if (typeof window !== 'undefined') window.__tgAppearanceDirty = false; };
  }, [appearanceDirty]);

  function confirmDiscardAppearance() {
    if (typeof window === 'undefined' || !window.confirm) return true;
    return window.confirm('Please save changes. Otherwise, no changes will be saved.\n\nLeave without saving?');
  }

  function goToSection(id) {
    if (id === activeSection) return;
    if (activeSection === 'appearance' && appearanceDirty && !confirmDiscardAppearance()) return;
    setActiveSection(id);
  }
  // Profile
  const [name,         setName]         = useState('');
  const [country,      setCountry]      = useState('');
  const [age,          setAge]          = useState('');
  const [gender,       setGender]       = useState('');
  const [weight,       setWeight]       = useState('');   // always kg
  const [height,       setHeight]       = useState('');   // always cm
  const [targetWeight, setTargetWeight] = useState('');   // always kg
  // Unit display toggles
  const [heightUnit,   setHeightUnit]   = useState('cm'); // 'cm' | 'ft'
  const [heightFt,     setHeightFt]     = useState('');
  const [heightIn,     setHeightIn]     = useState('');
  const [weightUnit,   setWeightUnit]   = useState('kg'); // 'kg' | 'lbs'
  const [weightLbs,    setWeightLbs]    = useState('');
  const [targetLbs,    setTargetLbs]    = useState('');
  const [goal,         setGoal]         = useState('');
  const [activity,     setActivity]     = useState('');
  const [mobility,     setMobility]     = useState('');
  // Food
  const [foodPrefs,    setFoodPrefs]    = useState([]);
  // Exercise schedule
  const [exTypes,      setExTypes]      = useState([]);
  const [exDays,       setExDays]       = useState('');
  const [restDays,     setRestDays]     = useState([]);
  const [exDuration,   setExDuration]   = useState('');
  const [exTimePref,   setExTimePref]   = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('');
  // Account
  const [newEmail,     setNewEmail]     = useState('');
  const [oldPwd,       setOldPwd]       = useState('');
  const [newPwd,       setNewPwd]       = useState('');
  const [confirmPwd,   setConfirmPwd]   = useState('');
  const [delPwd,       setDelPwd]       = useState('');
  // Feedback
  const [msg,          setMsg]          = useState('');
  const [pwMsg,        setPwMsg]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [toast,        setToast]        = useState('');
  const toastTimer = React.useRef(null);
  function flashToast(text) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const [deleteModal,  setDeleteModal]  = useState(false);
  // Family Role
  const [familyRole,   setFamilyRole]   = useState('');
  // Coach Voice
  const [voiceList,    setVoiceList]    = useState([]);
  const [voiceName,    setVoiceName]    = useState('');
  const [voiceRate,    setVoiceRate]    = useState(0.92);
  const [voicePitch,   setVoicePitch]   = useState(0.72);

  useEffect(() => {
    loadProfile();
    loadAppearance();
    loadVoiceSettings();
    // Load available voices for Coach Voice section
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const populateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length) setVoiceList(voices.map(v => ({ name: v.name, lang: v.lang })));
      };
      populateVoices();
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }
  }, []);

  async function loadVoiceSettings() {
    try {
      const [vn, vr, vp, fr] = await Promise.all([
        AsyncStorage.getItem('tg_voice_name'),
        AsyncStorage.getItem('tg_voice_rate'),
        AsyncStorage.getItem('tg_voice_pitch'),
        AsyncStorage.getItem('tg_family_role'),
      ]);
      if (vn) setVoiceName(vn);
      if (vr) setVoiceRate(parseFloat(vr));
      if (vp) setVoicePitch(parseFloat(vp));
      if (fr) setFamilyRole(fr);
    } catch {}
  }

  async function saveVoiceSetting(key, value) {
    await AsyncStorage.setItem(key, String(value));
  }

  function testVoice() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const utt = new window.SpeechSynthesisUtterance("Your coach is ready. Let's get to work.");
    const voices = window.speechSynthesis.getVoices();
    const match = voiceName ? voices.find(v => v.name === voiceName) : null;
    if (match) utt.voice = match;
    utt.rate  = voiceRate;
    utt.pitch = voicePitch;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  }

  async function loadAppearance() {
    // mode/accent/fontsize/corner/weather are owned by ThemeContext (per-username-scoped
    // AsyncStorage keys) and synced in via the effect above — only density/sidebar/anim
    // live outside the context and need to be loaded directly here.
    try {
      const [density, sw, anim] = await Promise.all([
        AsyncStorage.getItem('tg_density'),
        AsyncStorage.getItem('tg_sw'),
        AsyncStorage.getItem('tg_anim'),
      ]);
      const finalDensity = density || 'comfortable';
      if (density) setAppDensity(finalDensity);
      if (sw)      setAppSidebar(sw);
      if (anim)    setAppAnim(anim);
      applyDomExtras(appFontSize, appCorner, finalDensity);
    } catch {}
  }

  async function saveAppearanceSetting(key, value) {
    await AsyncStorage.setItem(key, value);
  }

  function switchHeightUnit(unit) {
    if (unit === heightUnit) return;
    if (unit === 'ft') {
      const cm = parseFloat(height);
      if (!isNaN(cm) && cm > 0) {
        const totalIn = cm / 2.54;
        setHeightFt(String(Math.floor(totalIn / 12)));
        setHeightIn(String(Math.round(totalIn % 12)));
      }
    } else {
      const ft = parseFloat(heightFt) || 0;
      const ins = parseFloat(heightIn) || 0;
      if (ft > 0 || ins > 0) setHeight(String(Math.round((ft * 12 + ins) * 2.54)));
    }
    setHeightUnit(unit);
  }

  function switchWeightUnit(unit) {
    if (unit === weightUnit) return;
    if (unit === 'lbs') {
      const kg = parseFloat(weight);
      if (!isNaN(kg) && kg > 0) setWeightLbs(String(Math.round(kg * 2.20462)));
      const tkg = parseFloat(targetWeight);
      if (!isNaN(tkg) && tkg > 0) setTargetLbs(String(Math.round(tkg * 2.20462)));
    } else {
      const lbs = parseFloat(weightLbs);
      if (!isNaN(lbs) && lbs > 0) setWeight(String(Math.round(lbs / 2.20462)));
      const tlbs = parseFloat(targetLbs);
      if (!isNaN(tlbs) && tlbs > 0) setTargetWeight(String(Math.round(tlbs / 2.20462)));
    }
    setWeightUnit(unit);
  }

  async function loadProfile() {
    const u = await getUser(); setUsername(u || '');
    try {
      const d = await getMe();
      if (d?.username) {
        setName(d.full_name || '');
        setCountry(d.country || '');
        setAge(d.age ? String(d.age) : '');
        setGender(d.gender || '');
        const wkg = d.weight_kg || d.weight || null;
        const hcm = d.height_cm || d.height || null;
        const tkg = d.target_weight_kg || null;
        setWeight(wkg ? String(wkg) : '');
        setHeight(hcm ? String(hcm) : '');
        setTargetWeight(tkg ? String(tkg) : '');
        if (wkg) setWeightLbs(String(Math.round(wkg * 2.20462 * 10) / 10));
        if (tkg) setTargetLbs(String(Math.round(tkg * 2.20462 * 10) / 10));
        if (hcm) {
          const totalIn = hcm / 2.54;
          setHeightFt(String(Math.floor(totalIn / 12)));
          setHeightIn(String(Math.round(totalIn % 12)));
        }
        setGoal(d.goal || '');
        setActivity(d.activity_level || '');
        setMobility(d.mobility_note || '');
        setFoodPrefs(d.food_prefs ? (Array.isArray(d.food_prefs) ? d.food_prefs : d.food_prefs.split(',').filter(Boolean)) : []);
        setNewEmail(d.email || '');
        setFamilyRole(d.family_role || '');
        if (d.exercise_types) setExTypes(d.exercise_types.split(',').filter(Boolean));
        if (d.exercise_days_per_week) setExDays(String(d.exercise_days_per_week));
        if (d.rest_day) setRestDays(d.rest_day.split(',').filter(Boolean));
        if (d.session_duration) setExDuration(d.session_duration);
        if (d.workout_time_pref) setExTimePref(d.workout_time_pref);
        if (d.fitness_level) setFitnessLevel(d.fitness_level);
      }
    } catch {}
  }

  async function doSaveProfile() {
    setMsg(''); setLoading(true);
    try {
      const hcm = heightUnit === 'ft'
        ? Math.round(((parseFloat(heightFt) || 0) * 12 + (parseFloat(heightIn) || 0)) * 2.54)
        : parseFloat(height) || null;
      const wkg = weightUnit === 'lbs'
        ? Math.round((parseFloat(weightLbs) || 0) / 2.20462 * 10) / 10
        : parseFloat(weight) || null;
      const tkg = weightUnit === 'lbs'
        ? Math.round((parseFloat(targetLbs) || 0) / 2.20462 * 10) / 10
        : parseFloat(targetWeight) || null;
      const r = await saveProfile({
        full_name: name,
        country,
        age: parseInt(age) || null,
        gender,
        weight_kg: wkg || null,
        height_cm: hcm || null,
        target_weight_kg: tkg || null,
        goal, activity_level: activity,
        mobility_note: mobility,
        food_prefs: foodPrefs.join(','),
        family_role: familyRole || undefined,
      });
      if (r?.ok) { setMsg('Profile saved.'); flashToast('Data saved'); await loadProfile(); }
      else setMsg(r?.error || 'Error saving profile.');
    } catch { setMsg('Could not reach server.'); }
    setLoading(false);
  }

  async function doChangeEmail() {
    setMsg(''); setLoading(true);
    try {
      const r = await changeEmail({ email: newEmail });
      if (r?.ok) { setMsg('Email updated.'); flashToast('Data saved'); }
      else setMsg(r?.error || 'Error.');
    } catch { setMsg('Could not reach server.'); }
    setLoading(false);
  }

  async function doChangePassword() {
    if (newPwd !== confirmPwd) { setPwMsg('Passwords do not match.'); return; }
    if (newPwd.length < 8)     { setPwMsg('Minimum 8 characters.'); return; }
    setPwMsg(''); setLoading(true);
    try {
      const token = await getToken();
      const r = await fetch(API_BASE + '/perfect/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
      }).then(x => x.json());
      if (r?.ok) { setPwMsg('Password updated.'); flashToast('Data saved'); setOldPwd(''); setNewPwd(''); setConfirmPwd(''); }
      else setPwMsg(r?.error || 'Error changing password.');
    } catch { setPwMsg('Could not reach server.'); }
    setLoading(false);
  }

  async function doDeleteAccount() {
    if (!delPwd) return;
    setLoading(true);
    try {
      const token = await getToken();
      const r = await fetch(API_BASE + '/perfect/settings/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ password: delPwd }),
      }).then(x => x.json());
      if (r?.ok) { await clearAuth(); if (navigation?.replace) navigation.replace('login'); }
      else { setMsg(r?.error || 'Wrong password.'); }
    } catch { setMsg('Could not reach server.'); }
    setLoading(false);
  }

  async function doSaveExercise() {
    setLoading(true);
    try {
      const exerciseData = {
        exercise_types: exTypes.join(','),
        exercise_days_per_week: parseInt(exDays) || null,
        rest_day: restDays.join(','),
        session_duration: exDuration,
        workout_time_pref: exTimePref,
        fitness_level: fitnessLevel,
      };
      if (IS_ELECTRON) {
        await local.saveProfile(exerciseData);
      } else {
        const token = await getToken();
        await fetch(API_BASE + '/perfect/api/account/exercise-prefs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify(exerciseData),
        });
      }
      setMsg('Exercise preferences saved.'); flashToast('Data saved');
    } catch { setMsg('Could not reach server.'); }
    setLoading(false);
  }

  async function doLogout() {
    await clearAuth();
    if (navigation?.replace) navigation.replace('login');
  }

  async function loadLogs() {
    const u = await getUser();
    const raw = await AsyncStorage.getItem(`toogood_daily_logs_${u}`);
    return raw ? JSON.parse(raw) : [];
  }

  async function exportDailySummaryCSV() {
    const logs = await loadLogs();
    const header = ['Date', 'Weight (kg)', 'Steps', 'Workout', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Hunger', 'Energy'];
    const rows = [...logs].sort((a, b) => a.date.localeCompare(b.date))
      .map(l => [l.date, l.weight || '', l.steps || '', l.workout || '', l.calories || 0, l.protein || 0, l.carbs || 0, l.fat || 0, l.hunger ?? '', l.energy ?? '']);
    downloadCSV(`toogood-daily-summary-${today()}.csv`, header, rows);
  }

  async function exportFoodLogCSV() {
    const logs = await loadLogs();
    const header = ['Date', 'Food', 'Serving', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Fiber (g)', 'Sugar (g)', 'Sodium (mg)', 'Alcohol (g)'];
    const rows = [];
    [...logs].sort((a, b) => a.date.localeCompare(b.date)).forEach(l => {
      (l.foods || []).forEach(f => {
        rows.push([l.date, f.name || '', f.serving || '', f.calories || 0, f.protein || 0, f.carbs || 0, f.fat || 0, f.fiber || '', f.sugar || '', f.sodium || '', f.alcohol || '']);
      });
    });
    downloadCSV(`toogood-food-log-${today()}.csv`, header, rows);
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function toggleFood(tag) {
    setFoodPrefs(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag]);
  }

  // Dynamic accent + mode — changes the whole page live
  const accentColor = ACCENT_MAP[appAccent] || C.gold;
  const accentDim   = accentColor + '1A';
  const isLight     = appMode === 'light';
  const mc = {
    bg:      isLight ? '#F5F0E8' : '#0A0A0A',
    sidebar: isLight ? '#EDE8DF' : '#080808',
    surface: isLight ? '#FFFFFF' : '#111111',
    text:    isLight ? '#1A1208' : '#E8DCC8',
    text2:   isLight ? '#6B5A3E' : '#8A7A62',
    text3:   isLight ? '#9A8A72' : '#4A3C2A',
    border:  isLight ? 'rgba(100,80,40,0.14)' : 'rgba(201,168,76,0.12)',
    borderH: isLight ? 'rgba(100,80,40,0.36)' : 'rgba(201,168,76,0.38)',
  };

  const dy = {
    navItemA:     { backgroundColor: accentDim, borderLeftWidth: 2, borderLeftColor: accentColor },
    segBtnActive: { backgroundColor: accentDim },
    pillA:        { borderColor: accentColor, backgroundColor: accentDim },
    goldBtn:      { backgroundColor: accentColor, padding: 12, alignItems: 'center', marginBottom: 8 },
    accentTxt:    { color: accentColor },
    // Mode-reactive colours
    screenBg:     { backgroundColor: mc.bg },
    navBg:        { backgroundColor: mc.sidebar, borderRightColor: mc.border },
    navTxt:       { color: mc.text },
    navGroupTxt:  { color: mc.text3 },
    navItemTxt:   { color: mc.text2 },
    sectionTitle: { color: mc.text },
    sectionSub:   { color: mc.text2 },
    settingLabel: { color: mc.text },
    settingDesc:  { color: mc.text2 },
    segControl:   { borderColor: mc.border },
    segBtn:       { borderRightColor: mc.border },
    segBtnTxt:    { color: mc.text2 },
    divider:      { borderTopColor: mc.border },
    inputStyle:   { borderBottomColor: accentColor + '38', color: mc.text },
  };

  const groups = [...new Set(NAV_SECTIONS.map(n => n.group))];

  // Dynamic — recreated when fontSize/mc changes so text scales live
  const st = StyleSheet.create({
    settingRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border, gap: 20, flexWrap: 'wrap' },
    settingLabel: { fontFamily: F.mono, fontSize: fontSize, color: C.text, marginBottom: 3 },
    settingDesc:  { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: C.text2, letterSpacing: 0.3, lineHeight: 18, maxWidth: 240 },
    segControl:   { flexDirection: 'row', borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
    segBtn:       { paddingVertical: 7, paddingHorizontal: 12, alignItems: 'center', borderRightWidth: 1, borderRightColor: C.border },
    segBtnActive: { backgroundColor: C.goldDim },
    segBtnTxt:    { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: C.text2, letterSpacing: 1, textTransform: 'uppercase' },
    leftNav:      { width: 220, backgroundColor: C.sidebar, borderRightWidth: 1, borderRightColor: C.border, padding: 24, paddingTop: 32 },
    navBrand:     { fontFamily: F.display, fontSize: 18, color: C.text, letterSpacing: 1, marginBottom: 24 },
    navGroup:     { fontFamily: F.mono, fontSize: 9, color: C.text3, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
    navItem:      { paddingVertical: 8, paddingHorizontal: 10, marginBottom: 2 },
    navItemA:     { backgroundColor: C.goldDim, borderLeftWidth: 2, borderLeftColor: C.gold },
    navItemTxt:   { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: C.text2, letterSpacing: 0.5 },
    content:      { flex: 1 },
    sectionTitle: { fontFamily: F.display, fontSize: 22, color: C.text, fontWeight: '400', letterSpacing: 1, marginBottom: 6 },
    sectionSub:   { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: C.text2, letterSpacing: 0.5, marginBottom: 24, lineHeight: 20 },
    subHead:      { fontFamily: F.mono, fontSize: 11, color: C.text3, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10, marginTop: 20, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border },
    label:        { fontFamily: F.mono, fontSize: 10, color: C.text3, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 },
    input:        { backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.22)', color: C.text, fontFamily: F.mono, fontSize: fontSize, paddingVertical: 8, marginBottom: 4, outlineWidth: 0 },
    msg:          { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), letterSpacing: 1, marginBottom: 16, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
    formGrid:     { gap: 18, marginBottom: 20 },
    field:        {},
    selectRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    pill:         { borderWidth: 1, borderColor: C.border, paddingVertical: 5, paddingHorizontal: 12 },
    pillA:        { borderColor: C.gold, backgroundColor: C.goldDim },
    pillTxt:      { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: C.text2, letterSpacing: 0.5 },
    goldBtn:      { backgroundColor: C.gold, padding: 12, alignItems: 'center', marginBottom: 8 },
    goldBtnTxt:   { color: '#060606', fontFamily: F.mono, fontWeight: '700', fontSize: Math.max(10, fontSize - 2), letterSpacing: 3, textTransform: 'uppercase' },
    ghostBtn:     { borderWidth: 1, borderColor: C.border, padding: 12, alignItems: 'center' },
    ghostBtnTxt:  { color: C.text2, fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), letterSpacing: 1 },
    infoRow:      { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 8 },
    modalBd:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
    modalSheet:   { width: '90%', maxWidth: 400, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.borderH, padding: 28 },
    modalTitle:   { fontFamily: F.display, fontSize: 20, color: C.text, letterSpacing: 1, marginBottom: 12 },
    delModal:     { width: 380, maxWidth: '90%', backgroundColor: C.elevated, borderWidth: 1, borderColor: 'rgba(201,76,76,0.3)', padding: 32, paddingBottom: 24 },
    dangerBtn:    { borderWidth: 1, borderColor: C.red, padding: 9, paddingHorizontal: 20, alignSelf: 'flex-start' },
    dangerTxt:    { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: C.red, letterSpacing: 1 },
    surface:      { backgroundColor: C.elevated },
  });

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: mc.bg }}>

      {/* Left nav */}
      <View style={[st.leftNav, { backgroundColor: mc.sidebar, borderRightColor: mc.border }]}>
        <Text style={[st.navBrand, { color: mc.text}]}>Settings</Text>
        {groups.map(g => (
          <View key={g} style={{ marginBottom: 14 }}>
            <Text style={[st.navGroup, { color: mc.text3 }]}>{g}</Text>
            {NAV_SECTIONS.filter(n => n.group === g).map(n => (
              <TouchableOpacity key={n.id} style={[st.navItem, activeSection === n.id && dy.navItemA]} onPress={() => goToSection(n.id)}>
                <Text style={[st.navItemTxt, { color: mc.text2 }, activeSection === n.id && dy.accentTxt]}>{n.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={{ marginTop: 'auto', paddingTop: 20, borderTopWidth: 1, borderTopColor: mc.border }}>
          <TouchableOpacity onPress={doLogout}>
            <Text style={{ fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: mc.text3, letterSpacing: 2 }}>Log out →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content */}
      <ScrollView style={[st.content, { backgroundColor: mc.bg }]} contentContainerStyle={{ padding: 32, paddingBottom: 60 }}>

        {msg ? <Text style={[st.msg, msg.toLowerCase().includes('error') || msg.includes("don't") ? { color: C.red } : { color: C.green }]}>{msg}</Text> : null}

        {/* ── Appearance ── */}
        {activeSection === 'appearance' && (
          <View>
            <Text style={[st.sectionTitle, { color: mc.text}]}>Appearance</Text>
            <Text style={[st.sectionSub, { color: mc.text2 }]}>Preview your changes here, then hit Save to apply them across the whole app.</Text>

            {/* Mode */}
            <View style={[st.settingRow, { borderBottomColor: mc.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.settingLabel, { color: mc.text }]}>Mode</Text>
                <Text style={[st.settingDesc, { color: mc.text2 }]}>Dark or light background.</Text>
              </View>
              <View style={[st.segControl, { borderColor: mc.border }]}>
                {['dark', 'light'].map(mod => (
                  <TouchableOpacity key={mod} style={[st.segBtn, { borderRightColor: mc.border }, appMode === mod && dy.segBtnActive]}
                    onPress={() => { setAppMode(mod); setAppearanceDirty(true); applyDomExtras(appFontSize, appCorner, appDensity); }}>
                    <Text style={[st.segBtnTxt, { color: mc.text2 }, appMode === mod && dy.accentTxt]}>{mod === 'dark' ? 'Dark' : 'Light'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Accent colour */}
            <View style={[st.settingRow, { borderBottomColor: mc.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.settingLabel, { color: mc.text }]}>Accent colour</Text>
                <Text style={[st.settingDesc, { color: mc.text2 }]}>Changes highlights, buttons, and active states.</Text>
              </View>
              <View style={{ gap: 10, alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', maxWidth: 210 }}>
                  {Object.entries(ACCENT_MAP).map(([key, color]) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() => { setAppAccent(key); setAppearanceDirty(true); applyDomExtras(appFontSize, appCorner, appDensity); }}
                      style={{
                        width: 28, height: 28, borderRadius: 14, backgroundColor: color,
                        borderWidth: 2, borderColor: appAccent === key ? mc.text : 'transparent',
                        outlineWidth: appAccent === key ? 2 : 0,
                        outlineColor: mc.text, outlineOffset: 3, outlineStyle: 'solid',
                      }}
                    />
                  ))}
                </View>
                <Text style={{ fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: accentColor, letterSpacing: 2, textTransform: 'uppercase' }}>
                  {ACCENT_NAME[appAccent] || 'Gold'}
                </Text>
              </View>
            </View>

            {/* Font size */}
            {(() => {
              const FS_KEYS = ['xs','sm','md','lg','xl'];
              const FS_PX   = { xs:10, sm:12, md:14, lg:16, xl:18 };
              const fsIdx   = Math.max(0, FS_KEYS.indexOf(appFontSize));
              const pct     = fsIdx / (FS_KEYS.length - 1);
              return (
                <View style={[st.settingRow, { borderBottomColor: mc.border, alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.settingLabel, { color: mc.text }]}>Font size</Text>
                    <Text style={[st.settingDesc, { color: mc.text2 }]}>Base text size across the app.</Text>
                  </View>
                  <View style={{ width: 180, gap: 8, paddingTop: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>A</Text>
                      {React.createElement('input', {
                        type: 'range', min: 0, max: 4, step: 1, value: fsIdx,
                        onChange: (e) => {
                          const v = FS_KEYS[Number(e.target.value)];
                          setAppFontSize(v); setAppearanceDirty(true);
                          applyDomExtras(v, appCorner, appDensity);
                        },
                        style: {
                          flex: 1, cursor: 'pointer', height: 4,
                          accentColor: accentColor,
                          background: `linear-gradient(to right, ${accentColor} ${pct * 100}%, ${mc.border} ${pct * 100}%)`,
                          outline: 'none', border: 'none',
                          WebkitAppearance: 'none', appearance: 'none',
                        },
                      })}
                      <Text style={{ fontFamily: F.mono, fontSize: 16, color: mc.text3 }}>A</Text>
                    </View>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor, letterSpacing: 1, textAlign: 'center' }}>
                      {FS_PX[appFontSize] || 14}px
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Corner style */}
            <View style={[st.settingRow, { borderBottomColor: mc.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.settingLabel, { color: mc.text }]}>Corner style</Text>
                <Text style={[st.settingDesc, { color: mc.text2 }]}>How rounded cards and buttons appear.</Text>
              </View>
              <View style={[st.segControl, { borderColor: mc.border }]}>
                {[['sharp','Sharp'],['soft','Soft'],['rounded','Rounded']].map(([v, l]) => (
                  <TouchableOpacity key={v} style={[st.segBtn, { borderRightColor: mc.border }, appCorner === v && dy.segBtnActive]}
                    onPress={() => { setAppCorner(v); setAppearanceDirty(true); applyDomExtras(appFontSize, v, appDensity); }}>
                    <Text style={[st.segBtnTxt, { color: mc.text2 }, appCorner === v && dy.accentTxt]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Chat density */}
            <View style={[st.settingRow, { borderBottomColor: mc.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.settingLabel, { color: mc.text }]}>Chat density</Text>
                <Text style={[st.settingDesc, { color: mc.text2 }]}>Spacing between messages in the AI chat.</Text>
              </View>
              <View style={[st.segControl, { borderColor: mc.border }]}>
                {[['compact','Compact'],['comfortable','Comfortable'],['spacious','Spacious']].map(([v, l]) => (
                  <TouchableOpacity key={v} style={[st.segBtn, { borderRightColor: mc.border }, appDensity === v && dy.segBtnActive]}
                    onPress={() => { setAppDensity(v); saveAppearanceSetting('tg_density', v); applyDomExtras(appFontSize, appCorner, v); }}>
                    <Text style={[st.segBtnTxt, { color: mc.text2 }, appDensity === v && dy.accentTxt]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sidebar width */}
            <View style={[st.settingRow, { borderBottomColor: mc.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.settingLabel, { color: mc.text }]}>Sidebar width</Text>
                <Text style={[st.settingDesc, { color: mc.text2 }]}>How wide the left navigation panel is.</Text>
              </View>
              <View style={[st.segControl, { borderColor: mc.border }]}>
                {[['narrow','Narrow'],['normal','Normal'],['wide','Wide']].map(([v, l]) => (
                  <TouchableOpacity key={v} style={[st.segBtn, { borderRightColor: mc.border }, appSidebar === v && dy.segBtnActive]}
                    onPress={() => { setAppSidebar(v); saveAppearanceSetting('tg_sw', v); applyDomExtras(appFontSize, appCorner, appDensity); }}>
                    <Text style={[st.segBtnTxt, { color: mc.text2 }, appSidebar === v && dy.accentTxt]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Animations */}
            <View style={[st.settingRow, { borderBottomColor: mc.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.settingLabel, { color: mc.text }]}>Animations</Text>
                <Text style={[st.settingDesc, { color: mc.text2 }]}>Transition speed for UI elements.</Text>
              </View>
              <View style={[st.segControl, { borderColor: mc.border }]}>
                {[['none','None'],['normal','Normal'],['snappy','Snappy']].map(([v, l]) => (
                  <TouchableOpacity key={v} style={[st.segBtn, { borderRightColor: mc.border }, appAnim === v && dy.segBtnActive]}
                    onPress={() => { setAppAnim(v); saveAppearanceSetting('tg_anim', v); }}>
                    <Text style={[st.segBtnTxt, { color: mc.text2 }, appAnim === v && dy.accentTxt]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Weather effects */}
            <View style={[st.settingRow, { borderBottomColor: mc.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.settingLabel, { color: mc.text }]}>Weather effects</Text>
                <Text style={[st.settingDesc, { color: mc.text2 }]}>Animated particles on the dashboard (rain, snow, etc.).</Text>
              </View>
              <TouchableOpacity
                style={{ paddingVertical: 7, paddingHorizontal: 18, borderWidth: 1, borderColor: appWeather ? accentColor : mc.border, backgroundColor: appWeather ? accentDim : 'transparent' }}
                onPress={() => { const v = !appWeather; setAppWeather(v); setAppearanceDirty(true); }}
              >
                <Text style={{ fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: appWeather ? accentColor : mc.text2, letterSpacing: 2, textTransform: 'uppercase' }}>{appWeather ? 'On' : 'Off'}</Text>
              </TouchableOpacity>
            </View>

            {/* Save — preview above is local only; this is what actually applies it app-wide */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 22 }}>
              <TouchableOpacity
                disabled={!appearanceDirty}
                onPress={() => {
                  setTheme(appMode, appAccent);
                  setExtras({ fontsize: appFontSize, corner: appCorner, weather: appWeather });
                  setAppearanceDirty(false);
                  flashToast('Appearance saved');
                }}
                style={{ paddingVertical: 11, paddingHorizontal: 26, backgroundColor: appearanceDirty ? accentColor : mc.border, opacity: appearanceDirty ? 1 : 0.5 }}
              >
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: appearanceDirty ? '#0A0A0A' : mc.text2, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700' }}>Save changes</Text>
              </TouchableOpacity>
              {appearanceDirty && (
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text2 }}>Unsaved — leaving this tab will prompt you.</Text>
              )}
            </View>
          </View>
        )}

        {/* ── Profile ── */}
        {activeSection === 'profile' && (
          <View>
            <Text style={[st.sectionTitle, { color: mc.text }]}>Profile</Text>
            <Text style={[st.sectionSub, { color: mc.text2 }]}>Your physical details help the AI personalise calorie targets, macro splits, and diet advice.</Text>

            <View style={st.formGrid}>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Lbl>Full Name</Lbl>
                  <Inp value={name} onChange={setName} placeholder="e.g. Saksham" />
                </View>
                <View style={{ flex: 1 }}>
                  <Lbl>Country</Lbl>
                  <Inp value={country} onChange={setCountry} placeholder="e.g. India" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Lbl>Age</Lbl>
                  <Inp value={age} onChange={setAge} placeholder="25" keyboard="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Lbl>Sex</Lbl>
                  <View style={st.selectRow}>
                    {GENDERS.map(([v, l]) => (
                      <TouchableOpacity key={v} style={[st.pill, gender === v && dy.pillA]} onPress={() => setGender(v)}>
                        <Text style={[st.pillTxt, gender === v && dy.accentTxt]}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              {/* Weight row */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={st.label}>Weight</Text>
                    <View style={{ flexDirection: 'row' }}>
                      {['kg','lbs'].map(u => (
                        <TouchableOpacity key={u} onPress={() => switchWeightUnit(u)} style={{ paddingVertical: 3, paddingHorizontal: 8, backgroundColor: weightUnit === u ? accentColor : 'transparent', borderWidth: 1, borderColor: weightUnit === u ? accentColor : mc.border }}>
                          <Text style={{ fontFamily: F.mono, fontSize: 10, color: weightUnit === u ? mc.bg : mc.text3, letterSpacing: 1 }}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <Inp value={weightUnit === 'kg' ? weight : weightLbs} onChange={weightUnit === 'kg' ? setWeight : setWeightLbs} placeholder={weightUnit === 'kg' ? '70' : '154'} keyboard="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={st.label}>Height</Text>
                    <View style={{ flexDirection: 'row' }}>
                      {['cm','ft'].map(u => (
                        <TouchableOpacity key={u} onPress={() => switchHeightUnit(u)} style={{ paddingVertical: 3, paddingHorizontal: 8, backgroundColor: heightUnit === u ? accentColor : 'transparent', borderWidth: 1, borderColor: heightUnit === u ? accentColor : mc.border }}>
                          <Text style={{ fontFamily: F.mono, fontSize: 10, color: heightUnit === u ? mc.bg : mc.text3, letterSpacing: 1 }}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  {heightUnit === 'cm' ? (
                    <Inp value={height} onChange={setHeight} placeholder="170" keyboard="decimal-pad" />
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View style={{ flex: 1 }}>
                        <Inp value={heightFt} onChange={setHeightFt} placeholder="5 ft" keyboard="number-pad" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Inp value={heightIn} onChange={setHeightIn} placeholder="8 in" keyboard="number-pad" />
                      </View>
                    </View>
                  )}
                </View>
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={st.label}>Target weight <Text style={{ color: mc.text3, fontSize: 10 }}>(optional)</Text></Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1 }}>{weightUnit}</Text>
                </View>
                <View style={{ maxWidth: 140 }}>
                  <Inp value={weightUnit === 'kg' ? targetWeight : targetLbs} onChange={weightUnit === 'kg' ? setTargetWeight : setTargetLbs} placeholder={weightUnit === 'kg' ? '65' : '143'} keyboard="decimal-pad" />
                </View>
              </View>
              <View>
                <Lbl>Your goal</Lbl>
                <View style={[st.selectRow, { marginTop: 4 }]}>
                  {GOALS.map(([v, l]) => (
                    <TouchableOpacity key={v} style={[st.pill, goal === v && dy.pillA]} onPress={() => setGoal(v)}>
                      <Text style={[st.pillTxt, goal === v && dy.accentTxt]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View>
                <Lbl>Activity level</Lbl>
                <View style={{ gap: 6, marginTop: 4 }}>
                  {ACTIVITY.map(([v, l]) => (
                    <TouchableOpacity key={v} style={[st.pill, activity === v && dy.pillA, { alignSelf: 'flex-start', paddingHorizontal: 16 }]} onPress={() => setActivity(v)}>
                      <Text style={[st.pillTxt, activity === v && dy.accentTxt]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View>
                <Lbl>Activity style</Lbl>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 10 }}>So the AI only suggests exercise that works for your body.</Text>
                <View style={[st.selectRow, { marginTop: 4 }]}>
                  {MOBILITY.map(([v, l]) => (
                    <TouchableOpacity key={v} style={[st.pill, mobility === v && dy.pillA]} onPress={() => setMobility(v)}>
                      <Text style={[st.pillTxt, mobility === v && dy.accentTxt]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <TouchableOpacity style={[dy.goldBtn, loading && { opacity: 0.6 }]} onPress={doSaveProfile} disabled={loading}>
              <Text style={st.goldBtnTxt}>{loading ? 'Saving…' : 'Save profile'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Food Preferences ── */}
        {activeSection === 'food' && (
          <View>
            <Text style={[st.sectionTitle, { color: mc.text }]}>Food Preferences</Text>
            <Text style={[st.sectionSub, { color: mc.text2 }]}>Tell the AI what you like to eat. It uses these to personalise every diet plan and recipe suggestion.</Text>
            <View style={[st.selectRow, { marginBottom: 24 }]}>
              {FOOD_TAGS.map(tag => (
                <TouchableOpacity key={tag} style={[st.pill, foodPrefs.includes(tag) && dy.pillA]} onPress={() => toggleFood(tag)}>
                  <Text style={[st.pillTxt, foodPrefs.includes(tag) && dy.accentTxt]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[dy.goldBtn, loading && { opacity: 0.6 }]} onPress={doSaveProfile} disabled={loading}>
              <Text style={st.goldBtnTxt}>{loading ? 'Saving…' : 'Save preferences'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Exercise Schedule ── */}
        {activeSection === 'exercise' && (
          <View>
            <Text style={[st.sectionTitle, { color: mc.text }]}>Exercise Schedule</Text>
            <Text style={[st.sectionSub, { color: mc.text2 }]}>Answer these once and the AI will build you a real weekly schedule — the right exercises, the right days, never touching your rest day.</Text>

            {/* Exercise types */}
            <Text style={[st.subHead, { color: mc.text3, borderBottomColor: mc.border }]}>Which exercises can you do?</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 12 }}>Pick everything that applies — even things you haven't tried yet but are open to.</Text>
            {EX_CATS.map(([cat, items]) => (
              <View key={cat}>
                <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: mc.text3, marginTop: 14, marginBottom: 8 }}>{cat}</Text>
                <View style={[st.selectRow, { marginBottom: 4 }]}>
                  {items.map(ex => (
                    <TouchableOpacity key={ex} style={[st.pill, exTypes.includes(ex) && dy.pillA]} onPress={() => setExTypes(p => p.includes(ex) ? p.filter(e => e !== ex) : [...p, ex])}>
                      <Text style={[st.pillTxt, exTypes.includes(ex) && dy.accentTxt]}>{ex}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            <View style={[st.settingRow, { borderBottomColor: mc.border, marginTop: 20 }]} />

            {/* Days per week */}
            <Text style={[st.subHead, { color: mc.text3, borderBottomColor: mc.border, marginTop: 16 }]}>How many days per week?</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 12 }}>Maximum 6 — at least one rest day is non-negotiable.</Text>
            <View style={[st.selectRow]}>
              {[1,2,3,4,5,6].map(d => (
                <TouchableOpacity key={d} style={[st.pill, exDays === String(d) && dy.pillA, { minWidth: 52, alignItems: 'center', flexDirection: 'column', gap: 2, paddingVertical: 10 }]}
                  onPress={() => setExDays(String(d))}>
                  <Text style={[{ fontFamily: F.mono, fontSize: 16, fontWeight: '700', color: mc.text2 }, exDays === String(d) && dy.accentTxt]}>{d}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: mc.text3 }}>{d > 1 ? 'days' : 'day'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[st.settingRow, { borderBottomColor: mc.border, marginTop: 20 }]} />

            {/* Rest days */}
            <Text style={[st.subHead, { color: mc.text3, borderBottomColor: mc.border, marginTop: 16 }]}>Which day(s) do you want to rest?</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 12 }}>Pick at least one. The AI will never schedule exercise on these days.</Text>
            <View style={st.selectRow}>
              {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => (
                <TouchableOpacity key={day} style={[st.pill, restDays.includes(day) && dy.pillA, { paddingHorizontal: 14 }]}
                  onPress={() => setRestDays(p => p.includes(day) ? p.filter(d => d !== day) : [...p, day])}>
                  <Text style={[st.pillTxt, restDays.includes(day) && dy.accentTxt]}>{day.slice(0,3)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[st.settingRow, { borderBottomColor: mc.border, marginTop: 20 }]} />

            {/* Session duration */}
            <Text style={[st.subHead, { color: mc.text3, borderBottomColor: mc.border, marginTop: 16 }]}>How long is each session?</Text>
            <View style={[st.selectRow, { marginTop: 12 }]}>
              {[['30min','30 min'],['45min','45 min'],['1hr','1 hour'],['90min','1.5 hrs'],['2hr','2 hrs+']].map(([v,l]) => (
                <TouchableOpacity key={v} style={[st.pill, exDuration === v && dy.pillA, { paddingHorizontal: 16 }]} onPress={() => setExDuration(v)}>
                  <Text style={[st.pillTxt, exDuration === v && dy.accentTxt]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[st.settingRow, { borderBottomColor: mc.border, marginTop: 20 }]} />

            {/* Preferred time */}
            <Text style={[st.subHead, { color: mc.text3, borderBottomColor: mc.border, marginTop: 16 }]}>When do you prefer to work out?</Text>
            <View style={[st.selectRow, { marginTop: 12 }]}>
              {[['early_morning','Early Morning','5–7 am'],['morning','Morning','7–10 am'],['afternoon','Afternoon','12–4 pm'],['evening','Evening','5–9 pm'],['flexible','Any Time','No preference']].map(([v,l,h]) => (
                <TouchableOpacity key={v} style={[st.pill, exTimePref === v && dy.pillA, { flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingVertical: 10, paddingHorizontal: 14 }]} onPress={() => setExTimePref(v)}>
                  <Text style={[st.pillTxt, exTimePref === v && dy.accentTxt]}>{l}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[st.settingRow, { borderBottomColor: mc.border, marginTop: 20 }]} />

            {/* Fitness level */}
            <Text style={[st.subHead, { color: mc.text3, borderBottomColor: mc.border, marginTop: 16 }]}>What's your current fitness level?</Text>
            <View style={[st.selectRow, { marginTop: 12 }]}>
              {[['beginner','Beginner','Just starting out'],['intermediate','Intermediate','Some experience'],['advanced','Advanced','Consistent for 2+ years'],['athlete','Athlete','Competitive / elite']].map(([v,l,h]) => (
                <TouchableOpacity key={v} style={[st.pill, fitnessLevel === v && dy.pillA, { flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingVertical: 10, paddingHorizontal: 14 }]} onPress={() => setFitnessLevel(v)}>
                  <Text style={[st.pillTxt, fitnessLevel === v && dy.accentTxt]}>{l}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[dy.goldBtn, { marginTop: 28 }, loading && { opacity: 0.6 }]} onPress={doSaveExercise} disabled={loading}>
              <Text style={st.goldBtnTxt}>{loading ? 'Saving…' : 'Save exercise schedule'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Family Role ── */}
        {activeSection === 'family' && (
          <View>
            <Text style={[st.sectionTitle, { color: mc.text }]}>Family Role</Text>
            <Text style={[st.sectionSub, { color: mc.text2 }]}>We'll greet you on your special family day — Father's Day, Mother's Day, and more.</Text>
            <View style={st.selectRow}>
              {FAMILY_ROLES.map(r => (
                <TouchableOpacity key={r} style={[st.pill, familyRole === r.toLowerCase() && dy.pillA]}
                  onPress={async () => {
                    const v = r.toLowerCase();
                    setFamilyRole(v);
                    await AsyncStorage.setItem('tg_family_role', v);
                  }}>
                  <Text style={[st.pillTxt, familyRole === r.toLowerCase() && dy.accentTxt]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[dy.goldBtn, { marginTop: 24 }, loading && { opacity: 0.6 }]} onPress={doSaveProfile} disabled={loading}>
              <Text style={st.goldBtnTxt}>Save role</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Account ── */}
        {activeSection === 'account' && (
          <View>
            <Text style={[st.sectionTitle, { color: mc.text }]}>Account & Security</Text>
            <Text style={[st.sectionSub, { color: mc.text2 }]}>Your account details and password management.</Text>

            {/* Info card */}
            <View style={[st.infoRow, { backgroundColor: mc.surface, borderColor: mc.border, marginBottom: 20 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: mc.text2 }}>Username</Text>
                <Text style={{ fontFamily: F.mono, fontSize: fontSize, color: mc.text }}>@{username}</Text>
              </View>
            </View>

            <Lbl>Email address</Lbl>
            <Inp value={newEmail} onChange={setNewEmail} placeholder="you@example.com" keyboard="email-address" />
            {msg ? <Text style={{ fontFamily: F.mono, fontSize: 11, color: msg.includes('Error') || msg.includes('error') ? C.red : C.green, marginBottom: 8 }}>{msg}</Text> : null}
            <TouchableOpacity style={[dy.goldBtn, loading && { opacity: 0.6 }]} onPress={doChangeEmail} disabled={loading}>
              <Text style={st.goldBtnTxt}>Save changes</Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: mc.border, marginVertical: 24 }} />
            <Text style={[st.sectionSub, { color: mc.text2, marginBottom: 20 }]}>Change your password below.</Text>
            <Lbl>Current password</Lbl>
            <Inp value={oldPwd} onChange={setOldPwd} placeholder="••••••••" secure />
            <Lbl>New password</Lbl>
            <Inp value={newPwd} onChange={setNewPwd} placeholder="••••••••" secure />
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginBottom: 10 }}>Minimum 8 characters</Text>
            <Lbl>Confirm new password</Lbl>
            <Inp value={confirmPwd} onChange={setConfirmPwd} placeholder="••••••••" secure />
            {pwMsg ? <Text style={{ fontFamily: F.mono, fontSize: 11, color: pwMsg.includes('updated') ? C.green : C.red, marginBottom: 8 }}>{pwMsg}</Text> : null}
            <TouchableOpacity style={[dy.goldBtn, loading && { opacity: 0.6 }]} onPress={doChangePassword} disabled={loading}>
              <Text style={st.goldBtnTxt}>Update password</Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: mc.border, marginTop: 32, marginBottom: 20 }} />
            <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', color: C.red, marginBottom: 10 }}>Danger zone</Text>
            <TouchableOpacity style={st.dangerBtn} onPress={doLogout}>
              <Text style={st.dangerTxt}>Log out of all devices</Text>
            </TouchableOpacity>
            <View style={{ height: 10 }} />
            <TouchableOpacity style={st.dangerBtn} onPress={() => { setDelPwd(''); setDeleteModal(true); }}>
              <Text style={st.dangerTxt}>Delete account</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Export Data ── */}
        {activeSection === 'data' && (
          <View>
            <Text style={[st.sectionTitle, { color: mc.text }]}>Export Data</Text>
            <Text style={[st.sectionSub, { color: mc.text2 }]}>Download everything you've logged as a spreadsheet — for your own records or to import elsewhere.</Text>

            <View style={[st.infoRow, { backgroundColor: mc.surface, borderColor: mc.border, marginBottom: 16 }]}>
              <Text style={{ fontFamily: F.mono, fontSize: fontSize, color: mc.text, marginBottom: 6 }}>Daily Summary</Text>
              <Text style={[st.settingDesc, { color: mc.text2, maxWidth: '100%', marginBottom: 14 }]}>One row per day: weight, steps, workout, and total calories/macros.</Text>
              <TouchableOpacity style={[dy.goldBtn, { alignSelf: 'flex-start', marginBottom: 0 }]} onPress={exportDailySummaryCSV}>
                <Text style={st.goldBtnTxt}>Download CSV</Text>
              </TouchableOpacity>
            </View>

            <View style={[st.infoRow, { backgroundColor: mc.surface, borderColor: mc.border }]}>
              <Text style={{ fontFamily: F.mono, fontSize: fontSize, color: mc.text, marginBottom: 6 }}>Food Log</Text>
              <Text style={[st.settingDesc, { color: mc.text2, maxWidth: '100%', marginBottom: 14 }]}>One row per food entry across every day you've logged, with full nutrition breakdown.</Text>
              <TouchableOpacity style={[dy.goldBtn, { alignSelf: 'flex-start', marginBottom: 0 }]} onPress={exportFoodLogCSV}>
                <Text style={st.goldBtnTxt}>Download CSV</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Hidden Chats ── */}
        {activeSection === 'chats' && (
          <View>
            <Text style={[st.sectionTitle, { color: mc.text }]}>Hidden Chats</Text>
            <Text style={[st.sectionSub, { color: mc.text2 }]}>Chats you've hidden from the sidebar. You can restore them here.</Text>
            <View style={{ borderWidth: 1, borderColor: C.border, minHeight: 60 }}>
              <Text style={{ padding: 24, textAlign: 'center', color: C.text3, fontFamily: F.mono, fontSize: fontSize, letterSpacing: 1 }}>
                Nothing hidden. How refreshingly transparent.
              </Text>
            </View>
          </View>
        )}

        {/* ── Coach Voice ── */}
        {activeSection === 'voice' && (
          <View>
            <Text style={[st.sectionTitle, { color: mc.text }]}>Coach Voice</Text>
            <Text style={[st.sectionSub, { color: mc.text2 }]}>Choose how your Coach sounds. All changes apply on the Coach page immediately.</Text>

            {/* Voice selector */}
            <View style={st.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.settingLabel}>Voice</Text>
                <Text style={st.settingDesc}>Voices available on your device. English (India) voices pronounce Indian names best.</Text>
              </View>
              <View style={{ minWidth: 200 }}>
                {typeof document !== 'undefined' ? (
                  <select
                    value={voiceName}
                    onChange={e => { setVoiceName(e.target.value); saveVoiceSetting('tg_voice_name', e.target.value); }}
                    style={{ width: '100%', background: '#181818', border: '1px solid rgba(201,168,76,0.18)', borderRadius: 4, color: '#E8DCC8', fontFamily: F.mono, fontSize: fontSize, padding: '9px 12px', outline: 'none', cursor: 'pointer' }}>
                    <option value="">System default</option>
                    {voiceList.map(v => (
                      <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                    ))}
                  </select>
                ) : (
                  <Text style={{ color: C.text3, fontFamily: F.mono, fontSize: 11 }}>Voice selection requires web browser</Text>
                )}
              </View>
            </View>

            {/* Speed */}
            <View style={st.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.settingLabel}>Speed — {voiceRate.toFixed(2)}x</Text>
                <Text style={st.settingDesc}>Slower speeds sound more deliberate and authoritative.</Text>
              </View>
              {typeof document !== 'undefined' && (
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <input type="range" min="0.5" max="1.8" step="0.05" value={voiceRate}
                    onChange={e => { const v = parseFloat(e.target.value); setVoiceRate(v); saveVoiceSetting('tg_voice_rate', v); }}
                    style={{ width: 150, accentColor: '#C9A84C', cursor: 'pointer' }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 150 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: C.text3, letterSpacing: 1 }}>SLOW</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: C.text3, letterSpacing: 1 }}>FAST</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Pitch */}
            <View style={st.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.settingLabel}>Pitch — {voicePitch.toFixed(2)}</Text>
                <Text style={st.settingDesc}>Lower pitch gives a deeper, more coach-like tone.</Text>
              </View>
              {typeof document !== 'undefined' && (
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <input type="range" min="0.3" max="2.0" step="0.05" value={voicePitch}
                    onChange={e => { const v = parseFloat(e.target.value); setVoicePitch(v); saveVoiceSetting('tg_voice_pitch', v); }}
                    style={{ width: 150, accentColor: '#C9A84C', cursor: 'pointer' }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 150 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: C.text3, letterSpacing: 1 }}>DEEP</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: C.text3, letterSpacing: 1 }}>HIGH</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Test button */}
            <TouchableOpacity style={[dy.goldBtn, { alignSelf: 'flex-start', marginTop: 16 }]} onPress={testVoice}>
              <Text style={st.goldBtnTxt}>Test voice</Text>
            </TouchableOpacity>
            <Text style={{ fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: C.text3, marginTop: 14, lineHeight: 18 }}>
              Tip: Look for an English (India) voice in the list above — it handles Indian names and sounds natural.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Delete account modal */}
      <Modal visible={deleteModal} transparent animationType="fade" onRequestClose={() => setDeleteModal(false)}>
        <TouchableOpacity style={st.modalBd} activeOpacity={1} onPress={() => setDeleteModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={st.delModal}>
              <Text style={{ fontFamily: F.mono, fontSize: fontSize, letterSpacing: 2, textTransform: 'uppercase', color: C.red, marginBottom: 10 }}>Delete account</Text>
              <Text style={{ fontFamily: F.mono, fontSize: fontSize, color: C.text2, lineHeight: 20, marginBottom: 22 }}>
                This cannot be undone. All your data, chats, and preferences will be permanently erased. Enter your password to confirm.
              </Text>
              <TextInput
                style={[st.input, { backgroundColor: mc.bg, borderWidth: 1, borderColor: mc.border, borderBottomWidth: 1, padding: 10, marginBottom: 6 }]}
                value={delPwd} onChangeText={setDelPwd}
                placeholder="Your password" placeholderTextColor={C.text3}
                secureTextEntry autoFocus={false}
              />
              {msg ? <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.red, marginBottom: 8 }}>{msg}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <TouchableOpacity style={st.ghostBtn} onPress={() => setDeleteModal(false)}>
                  <Text style={st.ghostBtnTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ backgroundColor: C.red, borderWidth: 1, borderColor: C.red, padding: 9, paddingHorizontal: 18 }} onPress={doDeleteAccount} disabled={loading}>
                  <Text style={{ color: '#fff', fontFamily: F.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>Delete forever</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {toast ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 28, alignItems: 'center' }}>
          <View style={{ backgroundColor: accentColor, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 4 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, color: '#060606', textTransform: 'uppercase' }}>{toast}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

