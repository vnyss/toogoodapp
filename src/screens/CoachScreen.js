import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Animated, Easing,
} from 'react-native';
import Svg, { Path, Polygon, Line, Rect, Circle } from 'react-native-svg';
import { C, F } from '../theme';
import { useTheme } from '../ThemeContext';
import { coachChat } from '../api';
import { getToken, getUser } from '../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// SVG icon helpers
// ─────────────────────────────────────────────────────────────────────────────

function IconSoundOn({ color = C.text3 }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </Svg>
  );
}

function IconSoundOff({ color = C.red }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <Line x1={23} y1={9} x2={17} y2={15} />
      <Line x1={17} y1={9} x2={23} y2={15} />
    </Svg>
  );
}

function IconMic({ color = C.text2 }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Line x1={12} y1={19} x2={12} y2={23} />
      <Line x1={8} y1={23} x2={16} y2={23} />
    </Svg>
  );
}

function IconStop({ color = C.gold }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill={color} stroke="none">
      <Rect x={5} y={5} width={14} height={14} rx={2} />
    </Svg>
  );
}

function IconSpinner({ color = C.text3 }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Path d="M21 12a9 9 0 1 1-9-9" />
    </Svg>
  );
}

function IconReplay({ color = C.text3 }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated sound wave — 5 bars that animate while coach is speaking
// ─────────────────────────────────────────────────────────────────────────────

function SoundWave({ active }) {
  const bars = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];

  useEffect(() => {
    if (!active) {
      bars.forEach(b => { b.stopAnimation(); b.setValue(0.3); });
      return;
    }
    const anims = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 80),
          Animated.timing(b, {
            toValue: 1,
            duration: 300 + i * 50,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(b, {
            toValue: 0.15,
            duration: 300 + i * 50,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [active]);

  return (
    <View style={st.soundWave}>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={[st.soundBar, { transform: [{ scaleY: b }] }]}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner animation wrapper (for thinking state on mic button)
// ─────────────────────────────────────────────────────────────────────────────

function SpinnerIcon() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.linear })
    ).start();
    return () => spin.stopAnimation();
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <IconSpinner />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

const HIST_KEY_PREFIX = 'tg_coach_hist_';
const MAX_DISPLAY     = 30;
const MAX_STORE       = 24;

// micState: 'idle' | 'listening' | 'thinking'
export default function CoachScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  const [messages,   setMessages]   = useState([]);
  const [micState,   setMicState]   = useState('idle');  // 'idle' | 'listening' | 'thinking'
  const [transcript, setTranscript] = useState('');
  const [muted,      setMuted]      = useState(false);
  const [speaking,   setSpeaking]   = useState(false);
  const [replayIdx,  setReplayIdx]  = useState(null);
  const [storKey,    setStorKey]    = useState(HIST_KEY_PREFIX + 'anon');
  const [hasSR,      setHasSR]      = useState(true); // SpeechRecognition available?

  const scrollRef   = useRef(null);
  const recognRef   = useRef(null);
  const historyRef  = useRef([]);  // mirrors messages for use inside callbacks
  const pulseAnim   = useRef(new Animated.Value(0)).current;
  const pulseLoop   = useRef(null);

  // Sync historyRef with messages state
  useEffect(() => { historyRef.current = messages; }, [messages]);

  // ── On mount: load user + history ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      const u = await getUser();
      const key = HIST_KEY_PREFIX + (u || 'anon');
      setStorKey(key);
      try {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          setMessages(parsed.slice(-MAX_DISPLAY));
        }
      } catch (_) {}

      // Check SpeechRecognition availability
      if (typeof window !== 'undefined') {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        setHasSR(!!SR);
      } else {
        setHasSR(false);
      }
    })();

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognRef.current) {
        try { recognRef.current.abort(); } catch (_) {}
      }
    };
  }, []);

  // ── Pulse animation while listening ─────────────────────────────────────
  useEffect(() => {
    if (micState === 'listening') {
      pulseAnim.setValue(0);
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
        ])
      );
      pulseLoop.current.start();
    } else {
      if (pulseLoop.current) pulseLoop.current.stop();
      pulseAnim.setValue(0);
    }
  }, [micState]);

  // ── Persist history ──────────────────────────────────────────────────────
  function saveHistory(msgs) {
    AsyncStorage.setItem(storKey, JSON.stringify(msgs.slice(-MAX_STORE))).catch(() => {});
  }

  // ── TTS speak ────────────────────────────────────────────────────────────
  const speak = useCallback(async (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (muted) return;

    // Load voice settings from AsyncStorage
    let voiceName = '', rate = 0.92, pitch = 0.72;
    try {
      const [vn, vr, vp] = await Promise.all([
        AsyncStorage.getItem('tg_voice_name'),
        AsyncStorage.getItem('tg_voice_rate'),
        AsyncStorage.getItem('tg_voice_pitch'),
      ]);
      if (vn) voiceName = vn;
      if (vr) rate = parseFloat(vr) || 0.92;
      if (vp) pitch = parseFloat(vp) || 0.72;
    } catch (_) {}

    const utt = new window.SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    if (voiceName) {
      const match = voices.find(v => v.name === voiceName);
      if (match) utt.voice = match;
    } else {
      // Auto-pick: prefer Indian English, then fallback English males
      const PREFER = [
        'Google हिन्दी',
        'Google English (India)',
        'Microsoft Heera',
        'Microsoft Ravi',
        'Microsoft David Desktop - English (United States)',
        'Microsoft David Desktop',
        'Microsoft David',
        'Microsoft Mark Desktop - English (United States)',
        'Microsoft Mark',
        'Google UK English Male',
        'Daniel',
        'Alex',
      ];
      let picked = null;
      for (const name of PREFER) {
        picked = voices.find(v => v.name === name);
        if (picked) break;
      }
      if (!picked) {
        picked = voices.find(v => v.lang.startsWith('en') && /david|mark|daniel|alex|james|george|male/i.test(v.name))
               || voices.find(v => v.lang.startsWith('en'))
               || null;
      }
      if (picked) utt.voice = picked;
    }

    utt.rate   = rate;
    utt.pitch  = pitch;
    utt.volume = 1.0;
    utt.onstart = () => setSpeaking(true);
    utt.onend   = () => { setSpeaking(false); setReplayIdx(null); };
    utt.onerror = () => { setSpeaking(false); setReplayIdx(null); };
    window.speechSynthesis.speak(utt);
  }, [muted]);

  // ── Replay a specific coach bubble ───────────────────────────────────────
  function replayBubble(text, idx) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setReplayIdx(idx);
    // Use speak but set replayIdx before so wave shows on that bubble
    speak(text).then(() => {});
  }

  // ── Mute toggle ──────────────────────────────────────────────────────────
  function toggleMute() {
    if (!muted && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
    setMuted(m => !m);
  }

  // ── Submit message to API ────────────────────────────────────────────────
  async function submit(text) {
    if (!text || micState === 'thinking') return;
    setTranscript('');

    const userMsg = { role: 'user', text };
    const next = [...historyRef.current, userMsg];
    setMessages(next);
    setMicState('thinking');

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);

    try {
      const history = historyRef.current.slice(-16).map(m => ({ role: m.role, text: m.text }));
      const d = await coachChat(text, history);
      const reply = (d && d.ok && d.reply) ? d.reply : 'Something went wrong — try again.';
      const coachMsg = { role: 'coach', text: reply };
      const withReply = [...next, coachMsg];
      setMessages(withReply);
      saveHistory(withReply);
      setMicState('idle');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      await speak(reply);
    } catch (_) {
      const errMsg = { role: 'coach', text: 'Connection issue — check your network.' };
      const withErr = [...next, errMsg];
      setMessages(withErr);
      saveHistory(withErr);
      setMicState('idle');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }

  // ── Submit transcript ────────────────────────────────────────────────────
  function submitTranscript() {
    const t = transcript.trim();
    if (!t) return;
    submit(t);
  }

  // ── Mic toggle ───────────────────────────────────────────────────────────
  function toggleMic() {
    if (micState === 'thinking') return;
    if (typeof window === 'undefined') return;

    if (micState === 'listening') {
      try { recognRef.current?.stop(); } catch (_) {}
      setMicState('idle');
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setHasSR(false); return; }

    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = 'en-US';
    recognRef.current  = rec;

    let finalText = '';

    rec.onstart = () => {
      setMicState('listening');
      setTranscript('');
      finalText = '';
    };

    rec.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      if (final) {
        finalText = final.trim();
        try { rec.stop(); } catch (_) {}
      }
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setTranscript('Could not hear — try again');
        setTimeout(() => setTranscript(''), 2200);
      }
      setMicState('idle');
    };

    rec.onend = () => {
      // Only auto-submit if we got a final via onresult (finalText set)
      // micState check: if still 'listening' means no explicit stop yet
      setMicState(prev => {
        if (prev === 'listening') {
          if (finalText) {
            // delay so state update settles
            setTimeout(() => submit(finalText), 0);
          }
          return 'idle';
        }
        return prev;
      });
    };

    try {
      rec.start();
    } catch (_) {
      setMicState('idle');
    }
  }

  // ── Clear chat ───────────────────────────────────────────────────────────
  function clearChat() {
    setMessages([]);
    setTranscript('');
    AsyncStorage.removeItem(storKey).catch(() => {});
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setReplayIdx(null);
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const isListening = micState === 'listening';
  const isThinking  = micState === 'thinking';

  const pulseScale1   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const pulseOpacity1 = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0.2, 0] });
  const pulseScale2   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.0] });
  const pulseOpacity2 = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.1, 0] });

  // Label shown under the heading
  const speakLabelText = isListening ? 'Listening...' : isThinking ? 'Coach is thinking...' : 'Speak your mind';
  const speakLabelDim  = isListening || isThinking;

  // ── Styles (reactive to theme) ───────────────────────────────────────────
  const st = StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: mc.bg,
      flexDirection: 'column',
      overflow: 'hidden',
    },

    // ── Top bar
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 4,
      position: 'absolute',
      top: 0,
      right: 0,
      left: 0,
      zIndex: 3,
    },
    muteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: mc.border,
    },
    muteBtnMuted: {
      borderColor: 'rgba(207,102,121,0.4)',
    },
    muteTxt: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 1,
    },
    clearBtn: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    clearBtnTxt: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },

    // ── Chat
    chat: {
      flex: 1,
      marginTop: 44,   // space below absolute top bar
    },
    chatContent: {
      paddingHorizontal: 48,
      paddingTop: 8,
      paddingBottom: 12,
      gap: 12,
    },
    chatContentEmpty: {
      flexGrow: 1,
      justifyContent: 'flex-start',
      paddingTop: 16,
    },
    emptyLabel: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 4,
      textTransform: 'uppercase',
    },

    // ── Bubbles
    bubbleUserWrap: {
      alignSelf: 'flex-end',
      maxWidth: '60%',
    },
    bubbleCoachWrap: {
      alignSelf: 'flex-start',
      maxWidth: '60%',
    },
    bubbleLabel: {
      fontFamily: F.mono,
      fontSize: 9,
      color: accentColor,
      letterSpacing: 6,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    bubbleUser: {
      paddingVertical: 11,
      paddingHorizontal: 15,
      backgroundColor: mc.goldDim,
      borderWidth: 1,
      borderColor: 'rgba(201,168,76,0.2)',
    },
    bubbleCoach: {
      paddingVertical: 11,
      paddingHorizontal: 15,
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
      position: 'relative',
      paddingRight: 28,
    },
    bubbleTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text,
      lineHeight: 23,
      letterSpacing: 0.3,
    },

    voicePlaceholder: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 4,
    },
    voiceMuted: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 2,
      fontStyle: 'italic',
    },
    waveRow: {
      alignItems: 'flex-start',
    },

    replayBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
    },

    // ── Thinking dots
    thinkingDots: {
      flexDirection: 'row',
      gap: 4,
      alignItems: 'center',
    },
    thinkingDot: {
      fontFamily: F.mono,
      fontSize: 12,
      color: mc.text3,
    },

    // ── Sound wave
    soundWave: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      height: 52,
    },
    soundBar: {
      width: 4,
      height: 52,
      borderRadius: 2,
      backgroundColor: accentColor,
    },

    // ── Bottom panel
    bottom: {
      flexShrink: 0,
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingBottom: 24,
      paddingTop: 12,
      gap: 8,
      zIndex: 2,
    },
    speakLabel: {
      fontFamily: F.display,
      fontSize: 26,
      color: mc.text,
      letterSpacing: 1,
      textAlign: 'center',
    },
    speakLabelDim: {
      opacity: 0.3,
    },
    transcriptTxt: {
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      color: accentColor,
      letterSpacing: 0.5,
      textAlign: 'center',
      fontStyle: 'italic',
      maxWidth: 520,
    },
    transcriptVisible: {
      opacity: 1,
    },
    transcriptHidden: {
      opacity: 0,
    },

    speakingWaveRow: {
      alignItems: 'center',
      marginBottom: 4,
    },
    speakingLabel: {
      fontFamily: F.mono,
      fontSize: 9,
      color: accentColor,
      letterSpacing: 4,
      textTransform: 'uppercase',
      marginTop: 6,
    },

    // ── Mic row
    micRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      marginVertical: 4,
    },
    micWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      width: 80,
      height: 80,
    },
    pulsing: {
      position: 'absolute',
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 1.5,
      borderColor: accentColor,
    },
    micBtn: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: mc.surface,
      borderWidth: 2,
      borderColor: mc.borderH,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    micBtnListening: {
      borderColor: accentColor,
      backgroundColor: mc.goldDim,
      shadowColor: accentColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
    micBtnThinking: {
      borderColor: mc.borderH,
      opacity: 0.6,
    },

    // ── Submit arrow
    submitBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: accentColor,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnDisabled: {
      opacity: 0.4,
    },
    submitArrow: {
      fontSize: 20,
      color: '#060606',
      fontWeight: '700',
      marginTop: -2,
      fontFamily: F.mono,
    },

    // ── No speech
    noSpeechTxt: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 2,
      textAlign: 'center',
    },
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={st.screen}>

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <View style={st.topBar}>
        <TouchableOpacity style={[st.muteBtn, muted && st.muteBtnMuted]} onPress={toggleMute}>
          {muted ? <IconSoundOff color={C.red} /> : <IconSoundOn color={mc.text3} />}
          <Text style={[st.muteTxt, muted && { color: C.red }]}>
            {muted ? 'Voice off' : 'Voice on'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={st.clearBtn} onPress={clearChat}>
          <Text style={st.clearBtnTxt}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* ── Chat scroll area ──────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={st.chat}
        contentContainerStyle={[st.chatContent, messages.length === 0 && st.chatContentEmpty]}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 ? (
          <Text style={st.emptyLabel}>Your session starts when you speak</Text>
        ) : (
          messages.slice(-MAX_DISPLAY).map((m, i) => {
            const globalIdx = messages.length - messages.slice(-MAX_DISPLAY).length + i;

            if (m.role === 'user') {
              return (
                <View key={i} style={st.bubbleUserWrap}>
                  <View style={st.bubbleUser}>
                    <Text style={st.bubbleTxt}>{m.text}</Text>
                  </View>
                </View>
              );
            }

            // Coach bubble — voice-only, show sound wave or placeholder
            const isThisReplaying = (replayIdx === globalIdx) && speaking;
            const isLastCoach = (i === messages.slice(-MAX_DISPLAY).length - 1) && m.role === 'coach';
            const showWave = (isLastCoach && speaking && replayIdx === null) || isThisReplaying;

            return (
              <View key={i} style={st.bubbleCoachWrap}>
                <Text style={st.bubbleLabel}>COACH</Text>
                <View style={st.bubbleCoach}>
                  {showWave && !muted ? (
                    <View style={st.waveRow}>
                      <SoundWave active={true} />
                    </View>
                  ) : muted ? (
                    <Text style={st.voiceMuted}>— voice muted —</Text>
                  ) : (
                    <Text style={st.voicePlaceholder}>♦  voice reply</Text>
                  )}

                  {/* Replay button */}
                  <TouchableOpacity
                    style={st.replayBtn}
                    onPress={() => replayBubble(m.text, globalIdx)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <IconReplay color={isThisReplaying ? accentColor : mc.text3} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* Thinking bubble */}
        {isThinking && (
          <View style={st.bubbleCoachWrap}>
            <Text style={st.bubbleLabel}>COACH</Text>
            <View style={st.bubbleCoach}>
              <View style={st.thinkingDots}>
                <ThinkingDot delay={0} />
                <ThinkingDot delay={200} />
                <ThinkingDot delay={400} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Bottom interaction panel ──────────────────────────────────── */}
      <View style={st.bottom}>

        {/* Main label */}
        <Text style={[st.speakLabel, speakLabelDim && st.speakLabelDim]}>
          {speakLabelText}
        </Text>

        {/* Transcript preview */}
        <Text style={[st.transcriptTxt, transcript ? st.transcriptVisible : st.transcriptHidden]}>
          {transcript || ' '}
        </Text>

        {/* Sound wave when user mic is listening */}
        {isListening && (
          <View style={st.speakingWaveRow}>
            <SoundWave active={true} />
            <Text style={st.speakingLabel}>Listening…</Text>
          </View>
        )}

        {/* Sound wave when coach is speaking (not replaying specific bubble) */}
        {speaking && !muted && replayIdx === null && (
          <View style={st.speakingWaveRow}>
            <SoundWave active={true} />
            <Text style={st.speakingLabel}>Coach is speaking</Text>
          </View>
        )}

        {/* Mic button row with pulse rings + optional submit arrow */}
        <View style={st.micRow}>

          {/* Mic button */}
          <View style={st.micWrap}>
            {/* Pulse ring 1 */}
            <Animated.View
              style={[st.pulsing, {
                transform: [{ scale: pulseScale1 }],
                opacity: pulseOpacity1,
              }]}
            />
            {/* Pulse ring 2 */}
            <Animated.View
              style={[st.pulsing, {
                transform: [{ scale: pulseScale2 }],
                opacity: pulseOpacity2,
              }]}
            />

            <TouchableOpacity
              style={[
                st.micBtn,
                isListening && st.micBtnListening,
                isThinking  && st.micBtnThinking,
              ]}
              onPress={toggleMic}
              disabled={isThinking}
              activeOpacity={0.8}
            >
              {isThinking ? (
                <SpinnerIcon />
              ) : isListening ? (
                <IconStop color={accentColor} />
              ) : (
                <IconMic color={isListening ? accentColor : mc.text2} />
              )}
            </TouchableOpacity>
          </View>

          {/* Submit arrow — shown after transcript is captured */}
          {(isListening || transcript.length > 0) && (
            <TouchableOpacity
              style={[st.submitBtn, (!transcript || isThinking) && st.submitBtnDisabled]}
              onPress={submitTranscript}
              disabled={!transcript || isThinking}
              activeOpacity={0.8}
            >
              <Text style={st.submitArrow}>↑</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* No speech recognition notice */}
        {!hasSR && (
          <Text style={st.noSpeechTxt}>
            Voice input not supported in this browser
          </Text>
        )}

      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Thinking dot sub-component
// ─────────────────────────────────────────────────────────────────────────────

function ThinkingDot({ delay }) {
  const anim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 480, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 0.2, duration: 480, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    return () => anim.stopAnimation();
  }, []);

  return (
    <Animated.Text style={[st.thinkingDot, { opacity: anim }]}>●</Animated.Text>
  );
}

