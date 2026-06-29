import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';

const REMINDER_TYPES = [
  { key: 'water',   label: 'Water reminders',       desc: 'Every 2 hours — drink a glass of water',  icon: '💧' },
  { key: 'meal',    label: 'Meal reminders',         desc: 'Breakfast 8am · Lunch 1pm · Dinner 7pm',  icon: '🍽️' },
  { key: 'workout', label: 'Workout reminder',       desc: 'Daily nudge to stay active at 6pm',       icon: '💪' },
  { key: 'log',     label: 'Daily log reminder',     desc: 'Log your day before sleep at 9pm',        icon: '📋' },
  { key: 'fast',    label: 'Fasting window alerts',  desc: 'Alert when fasting starts / eating window',icon: '⏱️' },
];

async function requestNotifPermission() {
  if (Platform.OS !== 'web') return false;
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

function sendTestNotif(label) {
  if (Platform.OS !== 'web' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  new Notification('Too Good', { body: `${label} — this is how your reminder will look`, icon: '/favicon.ico' });
}

export default function RemindersScreen() {
  const { mc, accentColor } = useTheme();
  const [enabled,     setEnabled]     = useState({});
  const [permission,  setPermission]  = useState('default');
  const [storageKey,  setStorageKey]  = useState(null);
  const intervalsRef  = useRef({});

  useEffect(() => {
    if (Platform.OS === 'web' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
    getUser().then(async u => {
      const key = `tg_reminders_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        setEnabled(d.enabled || {});
      }
    });
    return () => { Object.values(intervalsRef.current).forEach(clearInterval); };
  }, []);

  async function persist(patch) {
    if (!storageKey) return;
    const d = { enabled: { ...enabled, ...patch } };
    await AsyncStorage.setItem(storageKey, JSON.stringify(d));
  }

  async function toggle(key) {
    const nowEnabled = !enabled[key];

    if (nowEnabled) {
      const granted = await requestNotifPermission();
      if (!granted) {
        setPermission('denied');
        return;
      }
      setPermission('granted');
      scheduleReminder(key);
    } else {
      clearInterval(intervalsRef.current[key]);
      delete intervalsRef.current[key];
    }

    const updated = { ...enabled, [key]: nowEnabled };
    setEnabled(updated);
    persist(updated);
  }

  function scheduleReminder(key) {
    if (Platform.OS !== 'web') return;
    clearInterval(intervalsRef.current[key]);
    const type = REMINDER_TYPES.find(t => t.key === key);
    if (!type) return;

    if (key === 'water') {
      intervalsRef.current[key] = setInterval(() => {
        if (Notification.permission === 'granted') {
          new Notification('💧 Time to hydrate!', { body: 'Drink a glass of water to stay on track.', icon: '/favicon.ico' });
        }
      }, 2 * 60 * 60 * 1000);
    }

    if (key === 'meal') {
      const checkMeal = () => {
        if (Notification.permission !== 'granted') return;
        const now = new Date();
        const h = now.getHours(), m = now.getMinutes();
        if (h === 8 && m === 0)  new Notification('🍳 Breakfast time!', { body: 'Start your day with a healthy breakfast.', icon: '/favicon.ico' });
        if (h === 13 && m === 0) new Notification('🥗 Lunch time!',     { body: 'Don\'t skip lunch — fuel your afternoon.', icon: '/favicon.ico' });
        if (h === 19 && m === 0) new Notification('🍛 Dinner time!',    { body: 'Time for dinner. Keep it balanced.', icon: '/favicon.ico' });
      };
      intervalsRef.current[key] = setInterval(checkMeal, 60 * 1000);
    }

    if (key === 'workout') {
      const checkWorkout = () => {
        if (Notification.permission !== 'granted') return;
        const now = new Date();
        if (now.getHours() === 18 && now.getMinutes() === 0) {
          new Notification('💪 Time to move!', { body: 'You have a workout reminder for 6pm. Let\'s go!', icon: '/favicon.ico' });
        }
      };
      intervalsRef.current[key] = setInterval(checkWorkout, 60 * 1000);
    }

    if (key === 'log') {
      const checkLog = () => {
        if (Notification.permission !== 'granted') return;
        const now = new Date();
        if (now.getHours() === 21 && now.getMinutes() === 0) {
          new Notification('📋 Log your day', { body: 'Don\'t forget to log today\'s food, weight, and steps.', icon: '/favicon.ico' });
        }
      };
      intervalsRef.current[key] = setInterval(checkLog, 60 * 1000);
    }
  }

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 20, maxWidth: 560, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 24 },
    notice:  { borderWidth: 1, borderColor: mc.border, padding: 14, marginBottom: 20 },
    noticeTxt:{ fontFamily: F.mono, fontSize: 11, color: mc.text2, lineHeight: 18 },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 12 },
    cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    icon:    { fontSize: 20, marginRight: 12 },
    label:   { fontFamily: F.mono, fontSize: 13, color: mc.text, flex: 1 },
    desc:    { fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 10 },
    testBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: mc.border, paddingHorizontal: 10, paddingVertical: 5 },
    testTxt: { fontFamily: F.mono, fontSize: 10, color: mc.text3 },
    reqBtn:  { backgroundColor: accentColor, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
    reqTxt:  { fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700', letterSpacing: 1 },
  });

  const webNotifSupported = Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window;

  return (
    <ScrollView style={s.root}>
      <View style={s.content}>
        <Text style={s.title}>Reminders</Text>
        <Text style={s.sub}>HEALTH & WELLNESS NOTIFICATIONS</Text>

        {!webNotifSupported && (
          <View style={s.notice}>
            <Text style={s.noticeTxt}>
              ⚠️ Notifications require a modern browser.{'\n'}
              Please use Chrome, Edge, or Firefox on desktop/Android.
            </Text>
          </View>
        )}

        {webNotifSupported && permission === 'denied' && (
          <View style={s.notice}>
            <Text style={s.noticeTxt}>
              🚫 Notifications are blocked.{'\n'}
              Open your browser settings → Site permissions → Notifications → Allow for this site.
            </Text>
          </View>
        )}

        {webNotifSupported && permission !== 'granted' && permission !== 'denied' && (
          <TouchableOpacity style={s.reqBtn} onPress={async () => {
            const ok = await requestNotifPermission();
            setPermission(ok ? 'granted' : 'denied');
          }}>
            <Text style={s.reqTxt}>ALLOW NOTIFICATIONS</Text>
          </TouchableOpacity>
        )}

        {REMINDER_TYPES.map(type => (
          <View key={type.key} style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.icon}>{type.icon}</Text>
              <Text style={s.label}>{type.label}</Text>
              <Switch
                value={!!enabled[type.key]}
                onValueChange={() => toggle(type.key)}
                thumbColor={enabled[type.key] ? accentColor : mc.border}
                trackColor={{ false: mc.border, true: accentColor + '50' }}
              />
            </View>
            <Text style={s.desc}>{type.desc}</Text>
            {enabled[type.key] && permission === 'granted' && (
              <TouchableOpacity style={s.testBtn} onPress={() => sendTestNotif(type.label)}>
                <Text style={s.testTxt}>Send test notification</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <View style={[s.notice, { marginTop: 12 }]}>
          <Text style={s.noticeTxt}>
            ℹ️ Reminders only work while this browser tab is open.{'\n'}
            For persistent reminders, install the app as a PWA (Add to Home Screen).
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
