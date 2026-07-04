import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { getToken, getUser } from '../auth';

/* ─── constants ─── */
const BASE = 'http://127.0.0.1:5000';

/* ─── helpers ─── */
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  const today = todayISO();
  const yest  = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (iso === today) return 'Today';
  if (iso === yest)  return 'Yesterday';
  return new Date(iso + 'T12:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

async function apiG(path) {
  const h = { 'Content-Type': 'application/json' };
  const t = await getToken(); if (t) h.Authorization = 'Bearer ' + t;
  const r = await fetch(BASE + path, { headers: h });
  return r.json();
}
async function apiP(path, body) {
  const h = { 'Content-Type': 'application/json' };
  const t = await getToken(); if (t) h.Authorization = 'Bearer ' + t;
  const r = await fetch(BASE + path, {
    method: 'POST', headers: h, body: JSON.stringify(body),
  });
  return r.json();
}

/* ─── icons ─── */
function IconLock({ size = 11, color = C.text3 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round">
      <Rect x="3" y="11" width="18" height="11" rx="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}
function IconBook({ size = 38, color = C.gold }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.3" strokeLinecap="round">
      <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </Svg>
  );
}
function IconMic({ size = 13, color = C.text3 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <Rect x="9" y="2" width="6" height="11" rx="3" />
      <Path d="M5 10a7 7 0 0 0 14 0" />
      <Line x1="12" y1="21" x2="12" y2="17" />
    </Svg>
  );
}
function IconStar({ size = 13, color = C.text2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
    </Svg>
  );
}

/* ─── PIN dots display (4 filled/empty circles) ─── */
function PinDots({ filled, error }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={[
          styles.pinDot,
          filled > i && { backgroundColor: error ? C.red : C.gold, borderColor: error ? C.red : C.gold },
          error && { borderColor: C.red },
        ]} />
      ))}
    </View>
  );
}

/* ─── PinRow — DOM-based on web for reliable keyboard handling ─── */
function PinRow({ pinId, onComplete }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';
    container.style.cssText = 'display:flex;gap:12px;justify-content:center;align-items:center;';

    const inputs = [];
    const vals   = ['', '', '', ''];

    function tryComplete() {
      if (vals.every(v => v !== '')) {
        const pin = vals.join('');
        onComplete(pin, () => {
          vals.forEach((_, i) => { vals[i] = ''; inputs[i].value = ''; updateDot(i, false); });
          inputs[0].focus();
        });
      }
    }

    // Dot indicators above inputs
    const dotsRow = document.createElement('div');
    dotsRow.style.cssText = 'display:flex;gap:10px;margin-bottom:12px;position:absolute;top:-28px;left:50%;transform:translateX(-50%);';
    const dots = [];
    for (let i = 0; i < 4; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        width:10px;height:10px;border-radius:50%;
        border:2px solid rgba(201,168,76,0.38);
        background:transparent;transition:background 0.1s,border-color 0.1s;
      `;
      dots.push(dot);
      dotsRow.appendChild(dot);
    }

    function updateDot(idx, filled, error = false) {
      if (!dots[idx]) return;
      const c = error ? '#CF6679' : '#C9A84C';
      const b = error ? 'rgba(207,102,121,0.38)' : 'rgba(201,168,76,0.38)';
      dots[idx].style.background    = filled ? c : 'transparent';
      dots[idx].style.borderColor   = filled ? c : b;
    }

    // Wrapper for relative positioning
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;padding-top:28px;';
    wrap.appendChild(dotsRow);

    for (let i = 0; i < 4; i++) {
      const inp = document.createElement('input');
      inp.type         = 'password';
      inp.maxLength    = 1;
      inp.inputMode    = 'numeric';
      inp.pattern      = '[0-9]';
      inp.autocomplete = 'one-time-code';
      inp.style.cssText = `
        width:56px;height:68px;background:#161616;
        border:2px solid rgba(201,168,76,0.12);
        color:#EDE3CE;font-family:'JetBrains Mono',monospace;font-size:32px;
        text-align:center;outline:none;caret-color:transparent;
        -webkit-text-security:disc;text-security:disc;
        transition:border-color 0.15s,box-shadow 0.15s;box-sizing:border-box;
      `;

      inp.onfocus = () => {
        inp.style.borderColor = '#C9A84C';
        inp.style.boxShadow   = '0 0 0 3px rgba(201,168,76,0.15)';
      };
      inp.onblur = () => {
        inp.style.borderColor = vals[i] ? 'rgba(201,168,76,0.38)' : 'rgba(201,168,76,0.12)';
        inp.style.boxShadow   = 'none';
      };

      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace') {
          if (!vals[i] && i > 0) {
            vals[i - 1] = '';
            inputs[i - 1].value = '';
            updateDot(i - 1, false);
            inputs[i - 1].focus();
          } else {
            vals[i] = '';
            inp.value = '';
            updateDot(i, false);
            inp.style.borderColor = 'rgba(201,168,76,0.12)';
          }
          e.preventDefault();
        }
        if (e.key === 'ArrowLeft'  && i > 0) { inputs[i - 1].focus(); e.preventDefault(); }
        if (e.key === 'ArrowRight' && i < 3) { inputs[i + 1].focus(); e.preventDefault(); }
      });

      inp.addEventListener('input', e => {
        const digit = inp.value.replace(/\D/g, '').slice(-1);
        inp.value = digit;
        vals[i]   = digit;
        updateDot(i, !!digit);
        inp.style.borderColor = digit ? 'rgba(201,168,76,0.38)' : 'rgba(201,168,76,0.12)';
        if (digit && i < 3) inputs[i + 1].focus();
        tryComplete();
      });

      inp.addEventListener('paste', e => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData)
          .getData('text').replace(/\D/g, '').slice(0, 4);
        text.split('').forEach((ch, j) => {
          if (inputs[j]) { inputs[j].value = ch; vals[j] = ch; updateDot(j, true); }
        });
        const nextIdx = Math.min(text.length, 3);
        inputs[nextIdx].focus();
        if (text.length === 4) tryComplete();
      });

      wrap.appendChild(inp);
      inputs.push(inp);
    }

    container.appendChild(wrap);
    setTimeout(() => inputs[0] && inputs[0].focus(), 120);

    return () => { container.innerHTML = ''; };
  }, [pinId]);

  return (
    <View
      ref={containerRef}
      style={{ flexDirection: 'row', justifyContent: 'center', height: 96, alignItems: 'flex-end' }}
    />
  );
}

/* ─── main screen ─── */
export default function DiaryScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  const [view,          setView]         = useState('loading');
  const [showPinSetup,  setShowPinSetup] = useState(false);
  const [setupStep,     setSetupStep]    = useState(1);
  const [pin1,          setPin1]         = useState('');
  const [setupHint,     setSetupHint]    = useState('Enter a 4-digit PIN');
  const [setupErr,      setSetupErr]     = useState(false);
  const [pinRowKey,     setPinRowKey]    = useState(0);
  const [unlockHint,    setUnlockHint]   = useState('');
  const [unlockErr,     setUnlockErr]    = useState(false);
  const [lockEnabled,   setLockEnabled]  = useState(false);
  const [date,          setDate]         = useState(todayISO());
  const [entry,         setEntry]        = useState('');
  const [chars,         setChars]        = useState(0);
  const [showSaved,     setShowSaved]    = useState(false);
  const [aiPanel,       setAiPanel]      = useState(null);   // null | 'thinking' | string
  const [aiAdded,       setAiAdded]      = useState(false);
  const [micOn,         setMicOn]        = useState(false);
  const [acctPwd,       setAcctPwd]      = useState('');
  const [acctPwdErr,    setAcctPwdErr]   = useState('');
  const [acctPwdLoad,   setAcctPwdLoad]  = useState(false);
  const micRef    = useRef(null);
  const saveTimer = useRef(null);
  const entryRef  = useRef(entry);

  // Keep entryRef in sync so async callbacks use latest value
  useEffect(() => { entryRef.current = entry; }, [entry]);

  useEffect(() => { init(); }, []);

  /* ─── init ─── */
  async function init() {
    try {
      const lock = await apiG('/perfect/api/diary/lock');
      setLockEnabled(!!lock.enabled);
      if (!lock.setup_done)   { setView('setup'); }
      else if (lock.enabled)  { setView('locked'); }
      else                    { setView('unlocked'); loadEntry(todayISO()); }
    } catch {
      setView('setup');
    }
  }

  /* ─── entry I/O ─── */
  async function loadEntry(d) {
    try {
      const r = await apiG(`/perfect/api/diary/entry?date=${d}`);
      const t = r.entry || '';
      setEntry(t);
      setChars(t.length);
    } catch {}
  }

  async function saveEntry(silent = false) {
    try {
      await apiP('/perfect/api/diary/entry', { date, entry: entryRef.current });
      if (!silent) {
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 1800);
      }
    } catch {}
  }

  function autoSave() {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveEntry(true), 1500);
  }

  function changeDay(delta) {
    saveEntry(true);
    const d = new Date(date + 'T12:00');
    d.setDate(d.getDate() + delta);
    const next = d.toISOString().slice(0, 10);
    if (next > todayISO()) return;
    setDate(next);
    setAiPanel(null);
    setAiAdded(false);
    loadEntry(next);
  }

  /* ─── setup PIN ─── */
  async function handleSetupComplete(pin, reset) {
    if (setupStep === 1) {
      setPin1(pin);
      setSetupStep(2);
      setPinRowKey(k => k + 1);
      setSetupHint('Confirm your PIN');
      setSetupErr(false);
    } else {
      if (pin === pin1) {
        await apiP('/perfect/api/diary/lock', { action: 'setup', enabled: true, pin });
        setLockEnabled(true);
        setView('unlocked');
        loadEntry(todayISO());
      } else {
        setSetupHint("PINs don't match — try again");
        setSetupErr(true);
        setTimeout(() => {
          reset?.();
          setSetupStep(1);
          setPin1('');
          setSetupHint('Enter a 4-digit PIN');
          setSetupErr(false);
          setPinRowKey(k => k + 1);
        }, 900);
      }
    }
  }

  async function diaryNoPin() {
    await apiP('/perfect/api/diary/lock', { action: 'setup', enabled: false });
    setLockEnabled(false);
    setView('unlocked');
    loadEntry(todayISO());
  }

  /* ─── unlock ─── */
  async function handleUnlockComplete(pin, reset) {
    const r = await apiP('/perfect/api/diary/lock', { action: 'verify', pin });
    if (r.valid) {
      setView('unlocked');
      loadEntry(date);
    } else {
      setUnlockHint('Wrong PIN');
      setUnlockErr(true);
      setTimeout(() => {
        reset?.();
        setUnlockHint('');
        setUnlockErr(false);
        setPinRowKey(k => k + 1);
      }, 900);
    }
  }

  async function resetLock() {
    await apiP('/perfect/api/diary/lock', { action: 'setup', enabled: false });
    setLockEnabled(false);
    setView('setup');
    setShowPinSetup(false);
    setSetupStep(1);
    setPin1('');
    setSetupHint('Enter a 4-digit PIN');
    setSetupErr(false);
    setPinRowKey(k => k + 1);
  }

  /* ─── account password check before changing PIN ─── */
  function startChangePIN() {
    setAcctPwd('');
    setAcctPwdErr('');
    setView('acctPwdCheck');
  }

  async function verifyAcctPwd() {
    if (!acctPwd) { setAcctPwdErr('Enter your account password.'); return; }
    setAcctPwdLoad(true);
    try {
      const r = await apiP('/perfect/api/verify-password', { password: acctPwd });
      if (r.valid) {
        setAcctPwd('');
        setAcctPwdErr('');
        setSetupStep(1);
        setPin1('');
        setSetupHint('Enter a new 4-digit PIN');
        setSetupErr(false);
        setPinRowKey(k => k + 1);
        setShowPinSetup(true);
        setView('setup');
      } else {
        setAcctPwdErr('Wrong password. Try again.');
      }
    } catch {
      setAcctPwdErr('Could not reach server.');
    }
    setAcctPwdLoad(false);
  }

  /* ─── mic ─── */
  function toggleMic() {
    if (micOn) {
      if (micRef.current) { micRef.current.onend = null; try { micRef.current.stop(); } catch {} }
      micRef.current = null;
      setMicOn(false);
      saveEntry(true);
      return;
    }
    if (Platform.OS !== 'web') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const m = new SR();
    micRef.current = m;
    let final = entryRef.current;
    m.continuous      = true;
    m.interimResults  = true;
    m.lang            = 'en-US';
    m.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
        else interim = e.results[i][0].transcript;
      }
      const t = final + interim;
      setEntry(t);
      setChars(t.length);
    };
    m.onerror = () => { setMicOn(false); micRef.current = null; };
    m.onend = () => { if (micRef.current) m.start(); };
    m.start();
    setMicOn(true);
  }

  /* ─── AI review ─── */
  async function aiReview() {
    if (!entry.trim()) return;
    setAiPanel('thinking');
    setAiAdded(false);
    try {
      const r = await apiP('/perfect/api/assistant', {
        history: [],
        diary_review: true,
        message:
          'Please review my day and give thoughtful, personal feedback based on everything below.' +
          `\n\nMY DIARY ENTRY:\n${entry}` +
          '\n\nBe warm, personal and encouraging. Point out what went well and any gentle suggestions.',
      });
      setAiPanel(r.reply || 'No response from AI.');
    } catch {
      setAiPanel('Could not reach the AI. Check your connection and try again.');
    }
  }

  async function addAiToEntry() {
    const sep = '\n\n— AI Review —\n';
    const newEntry = (entry.trim() ? entry.trim() + sep : sep) + aiPanel;
    setEntry(newEntry);
    setChars(newEntry.length);
    entryRef.current = newEntry;
    await saveEntry(false);
    setAiAdded(true);
  }

  /* ════════════════════════════════
     VIEWS
  ════════════════════════════════ */

  /* ════════════════════════════════
     STYLES (theme-reactive)
  ════════════════════════════════ */
  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: mc.bg },

    /* gate / lock screens */
    gateOuter: {
      alignItems: 'center',
      gap: 20,
      paddingTop: 64,
      paddingHorizontal: 24,
      paddingBottom: 60,
    },
    gateTitle: {
      fontFamily: F.display,
      fontSize: 22,
      color: mc.text,
      letterSpacing: 1,
      textAlign: 'center',
    },
    gateSub: {
      fontSize: Math.max(10, fontSize - 2),
      color: mc.text2,
      fontFamily: F.mono,
      lineHeight: 20,
      textAlign: 'center',
      maxWidth: 300,
    },
    pinDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: 'rgba(201,168,76,0.38)',
      backgroundColor: 'transparent',
    },
    hint: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 1,
      minHeight: 16,
      textAlign: 'center',
    },
    linkTxt: {
      color: mc.text3,
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      textDecorationLine: 'underline',
      letterSpacing: 1,
    },
    acctInput: {
      backgroundColor: mc.elevated,
      borderWidth: 2,
      borderColor: mc.border,
      color: mc.text,
      fontFamily: F.mono,
      fontSize: fontSize,
      paddingHorizontal: 14,
      paddingVertical: 12,
      outlineWidth: 0,
    },

    /* buttons */
    goldBtn: {
      backgroundColor: accentColor,
      padding: 12,
      alignItems: 'center',
    },
    goldBtnTxt: {
      color: '#060606',
      fontFamily: F.mono,
      fontWeight: '700',
      fontSize: fontSize,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    ghostBtn: {
      borderWidth: 1,
      borderColor: mc.border,
      padding: 12,
      alignItems: 'center',
    },
    ghostBtnTxt: {
      color: mc.text2,
      fontFamily: F.mono,
      fontSize: fontSize,
      letterSpacing: 1,
    },

    /* notebook */
    notebook: {
      width: '100%',
      maxWidth: 760,
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
    },
    nbHeader: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    navArrowBtn: { padding: 4 },
    navArrow: {
      color: mc.text3,
      fontSize: 20,
      fontFamily: F.mono,
      lineHeight: 20,
    },
    nbDateLabel: {
      fontFamily: F.display,
      fontSize: 16,
      color: mc.text,
      letterSpacing: 1,
      flex: 1,
    },
    lockBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    lockBtnTxt: {
      color: mc.text3,
      fontFamily: F.mono,
      fontSize: 10,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    nbBody: {},
    nbTextArea: {
      minHeight: 380,
      backgroundColor: 'transparent',
      color: mc.text,
      fontFamily: F.mono,
      fontSize: 15,
      lineHeight: 28,
      padding: 16,
      borderWidth: 0,
      outlineWidth: 0,
      textAlignVertical: 'top',
      letterSpacing: 0.3,
    },
    nbToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderTopWidth: 1,
      borderTopColor: mc.border,
    },
    micBtn: {
      width: 32,
      height: 32,
      borderWidth: 1,
      borderColor: mc.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nbChars: {
      color: mc.text3,
      fontFamily: F.mono,
      fontSize: 11,
      flex: 1,
      letterSpacing: 1,
    },
    savedTxt: {
      color: mc.text3,
      fontFamily: F.mono,
      fontSize: 11,
      letterSpacing: 1,
    },
    lockDiaryBtn: {
      borderWidth: 1,
      borderColor: 'rgba(207,102,121,0.35)',
      paddingVertical: 6,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    lockDiaryBtnTxt: {
      color: C.red,
      fontFamily: F.mono,
      fontSize: 11,
      letterSpacing: 2,
    },
    saveBtn: {
      backgroundColor: accentColor,
      paddingVertical: 7,
      paddingHorizontal: 18,
    },
    saveBtnTxt: {
      color: '#060606',
      fontFamily: F.mono,
      fontWeight: '700',
      fontSize: 12,
      letterSpacing: 2,
    },

    /* AI */
    aiBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 20,
      backgroundColor: mc.elevated,
      borderTopWidth: 1,
      borderTopColor: mc.border,
    },
    aiBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: mc.border,
      paddingVertical: 7,
      paddingHorizontal: 14,
    },
    aiBtnTxt: {
      color: mc.text2,
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      letterSpacing: 1,
    },
    aiPanel: {
      padding: 16,
      paddingHorizontal: 20,
      backgroundColor: mc.elevated,
      borderTopWidth: 1,
      borderTopColor: mc.border,
    },
    aiDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: accentColor,
      opacity: 0.6,
    },
    aiText: {
      color: mc.text,
      fontFamily: F.mono,
      fontSize: fontSize,
      lineHeight: 22,
      marginBottom: 14,
      whiteSpace: 'pre-wrap',
    },
    addToRecord: {
      backgroundColor: accentColor,
      paddingVertical: 7,
      paddingHorizontal: 16,
      alignSelf: 'flex-start',
    },
    addToRecordTxt: {
      color: '#060606',
      fontFamily: F.mono,
      fontWeight: '700',
      fontSize: Math.max(10, fontSize - 2),
      letterSpacing: 2,
    },
  });

  /* loading */
  if (view === 'loading') {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={accentColor} />
      </View>
    );
  }

  /* account password check */
  if (view === 'acctPwdCheck') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.gateOuter}>
        <View style={{ marginBottom: 16, opacity: 0.75 }}>
          <IconLock size={38} color={accentColor} />
        </View>
        <Text style={styles.gateTitle}>Verify your identity</Text>
        <Text style={styles.gateSub}>
          Enter your account password to change the diary PIN.
        </Text>
        <View style={{ width: '100%', maxWidth: 280, gap: 12 }}>
          <TextInput
            value={acctPwd}
            onChangeText={t => { setAcctPwd(t); setAcctPwdErr(''); }}
            secureTextEntry
            placeholder="Account password"
            placeholderTextColor={mc.text3}
            style={styles.acctInput}
            onSubmitEditing={verifyAcctPwd}
            returnKeyType="go"
            autoFocus
          />
          {!!acctPwdErr && (
            <Text style={{ color: C.red, fontFamily: F.mono, fontSize: 12, textAlign: 'center' }}>
              {acctPwdErr}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.goldBtn, acctPwdLoad && { opacity: 0.6 }]}
            onPress={verifyAcctPwd}
            disabled={acctPwdLoad}>
            <Text style={styles.goldBtnTxt}>{acctPwdLoad ? 'Checking...' : 'Continue'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setView('unlocked')} style={{ alignItems: 'center' }}>
            <Text style={styles.linkTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  /* setup PIN */
  if (view === 'setup') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.gateOuter}>
        <View style={{ marginBottom: 8, opacity: 0.75 }}>
          <IconBook size={38} color={accentColor} />
        </View>
        <Text style={styles.gateTitle}>Welcome to your diary</Text>
        <Text style={styles.gateSub}>
          Would you like to protect it with a 4-digit PIN?
        </Text>

        {!showPinSetup ? (
          <View style={{ gap: 10, width: '100%', maxWidth: 260 }}>
            <TouchableOpacity
              style={styles.goldBtn}
              onPress={() => {
                setShowPinSetup(true);
                setSetupStep(1);
                setPin1('');
                setSetupHint('Enter a 4-digit PIN');
                setSetupErr(false);
                setPinRowKey(k => k + 1);
              }}>
              <Text style={styles.goldBtnTxt}>Set a 4-digit PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={diaryNoPin}>
              <Text style={styles.ghostBtnTxt}>Open without PIN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 16 }}>
            <PinRow
              pinId={`setup_${setupStep}_${pinRowKey}`}
              onComplete={handleSetupComplete}
            />
            <Text style={[styles.hint, setupErr && { color: C.red }]}>{setupHint}</Text>
            <TouchableOpacity
              onPress={() => {
                setShowPinSetup(false);
                setSetupStep(1);
                setPin1('');
                setSetupHint('Enter a 4-digit PIN');
                setSetupErr(false);
                setPinRowKey(k => k + 1);
              }}>
              <Text style={styles.linkTxt}>← Go back</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  }

  /* locked */
  if (view === 'locked') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.gateOuter}>
        <View style={{ marginBottom: 8, opacity: 0.75 }}>
          <IconLock size={38} color={accentColor} />
        </View>
        <Text style={styles.gateTitle}>Diary is locked</Text>
        <Text style={styles.gateSub}>Enter your 4-digit PIN to open.</Text>
        <PinRow
          pinId={`unlock_${pinRowKey}`}
          onComplete={handleUnlockComplete}
        />
        <Text style={[styles.hint, unlockErr && { color: C.red }]}>{unlockHint || ' '}</Text>
        <TouchableOpacity onPress={resetLock} style={{ marginTop: 4 }}>
          <Text style={styles.linkTxt}>Forgot PIN? Reset lock</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  /* unlocked — notebook */
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ alignItems: 'center', padding: 24, paddingBottom: 60 }}>
      <View style={styles.notebook}>

        {/* ── Header ── */}
        <View style={styles.nbHeader}>
          <TouchableOpacity onPress={() => changeDay(-1)} style={styles.navArrowBtn}>
            <Text style={styles.navArrow}>{'<'}</Text>
          </TouchableOpacity>

          <Text style={styles.nbDateLabel}>{fmtDate(date)}</Text>

          <TouchableOpacity
            onPress={() => changeDay(1)}
            disabled={date >= todayISO()}
            style={[styles.navArrowBtn, date >= todayISO() && { opacity: 0.2 }]}>
            <Text style={styles.navArrow}>{'>'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.lockBtn}
            onPress={lockEnabled ? startChangePIN : () => { setShowPinSetup(false); setView('setup'); }}>
            <IconLock size={11} color={mc.text3} />
            <Text style={styles.lockBtnTxt}>{lockEnabled ? 'Change PIN' : 'Set PIN'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Body ── */}
        <View style={styles.nbBody}>
          <TextInput
            multiline
            value={entry}
            onChangeText={t => { setEntry(t); setChars(t.length); autoSave(); }}
            placeholder="Write your thoughts here..."
            placeholderTextColor={mc.text3}
            style={styles.nbTextArea}
            textAlignVertical="top"
          />
        </View>

        {/* ── Toolbar ── */}
        <View style={styles.nbToolbar}>
          <TouchableOpacity
            style={[styles.micBtn, micOn && { borderColor: accentColor, backgroundColor: mc.goldDim }]}
            onPress={toggleMic}>
            <IconMic size={13} color={micOn ? accentColor : mc.text3} />
          </TouchableOpacity>

          <Text style={styles.nbChars}>{chars} chars</Text>

          {showSaved && (
            <Text style={styles.savedTxt}>Saved</Text>
          )}

          {lockEnabled && (
            <TouchableOpacity
              style={styles.lockDiaryBtn}
              onPress={() => { saveEntry(true); setView('locked'); }}>
              <IconLock size={12} color={C.red} />
              <Text style={styles.lockDiaryBtnTxt}>Lock</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={() => saveEntry(false)}>
            <Text style={styles.saveBtnTxt}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* ── AI bar ── */}
        <View style={styles.aiBar}>
          <TouchableOpacity
            style={[styles.aiBtn, aiPanel === 'thinking' && { opacity: 0.5 }]}
            onPress={aiReview}
            disabled={aiPanel === 'thinking'}>
            <IconStar size={13} color={mc.text2} />
            <Text style={styles.aiBtnTxt}>Let AI review my day</Text>
          </TouchableOpacity>
        </View>

        {/* ── AI panel ── */}
        {aiPanel !== null && (
          <View style={styles.aiPanel}>
            {aiPanel === 'thinking' ? (
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 4 }}>
                <View style={styles.aiDot} />
                <View style={styles.aiDot} />
                <View style={styles.aiDot} />
              </View>
            ) : (
              <>
                <Text style={styles.aiText}>{aiPanel}</Text>
                {!aiAdded && (
                  <TouchableOpacity style={styles.addToRecord} onPress={addAiToEntry}>
                    <Text style={styles.addToRecordTxt}>Add to today's record</Text>
                  </TouchableOpacity>
                )}
                {aiAdded && (
                  <Text style={{ color: mc.text3, fontFamily: F.mono, fontSize: 11, letterSpacing: 1 }}>Added</Text>
                )}
              </>
            )}
          </View>
        )}

      </View>
    </ScrollView>
  );
}

