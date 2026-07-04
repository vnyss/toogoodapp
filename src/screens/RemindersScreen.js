import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Switch } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';
import { StatBar, BarChart } from '../components/Charts';

const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const DEFAULT_REMINDERS = [
  {
    key: 'water', label: 'Water', icon: '', color: '#42A5F5',
    desc: 'Stay hydrated throughout the day',
    type: 'interval',
    interval: 120,
    days: [1,2,3,4,5,6,0],
    activeFrom: '07:00', activeTo: '22:00',
    message: 'Time to hydrate! Drink a glass of water.',
    enabled: false,
  },
  {
    key: 'meal', label: 'Meals', icon: '', color: '#FFB74D',
    desc: 'Breakfast, lunch and dinner reminders',
    type: 'times',
    times: ['08:00', '13:00', '19:00'],
    days: [1,2,3,4,5,6,0],
    messages: ['Breakfast time! Start the day right.', 'Lunch time! Fuel your afternoon.', 'Dinner time! Keep it balanced.'],
    enabled: false,
  },
  {
    key: 'workout', label: 'Workout', icon: '', color: '#E57373',
    desc: 'Daily workout nudge',
    type: 'times',
    times: ['18:00'],
    days: [1,2,3,4,5],
    messages: ['Time to move! Your workout window is open.'],
    enabled: false,
  },
  {
    key: 'log', label: 'Daily Log', icon: '', color: '#4CAF7C',
    desc: 'Log food, steps and water before bed',
    type: 'times',
    times: ['21:00'],
    days: [1,2,3,4,5,6,0],
    messages: ['Log your day! Food, steps, water — all logged?'],
    enabled: false,
  },
  {
    key: 'sleep', label: 'Bedtime', icon: '', color: '#7C8BF5',
    desc: 'Wind-down reminder before sleep',
    type: 'times',
    times: ['22:30'],
    days: [1,2,3,4,5,6,0],
    messages: ['Bedtime soon. Put screens down and wind down.'],
    enabled: false,
  },
  {
    key: 'steps', label: 'Step Goal', icon: '', color: '#AB47BC',
    desc: "Evening nudge if you haven't hit your step goal",
    type: 'times',
    times: ['17:00'],
    days: [1,2,3,4,5,6,0],
    messages: ['Step check! Have you hit your step goal today?'],
    enabled: false,
  },
  {
    key: 'fast', label: 'Fasting', icon: '—', color: '#26C6DA',
    desc: 'Alert for fasting window start and end',
    type: 'times',
    times: ['20:00', '12:00'],
    days: [1,2,3,4,5,6,0],
    messages: ['Fasting window starts now. Stop eating until tomorrow.', 'Eating window open! You can break your fast.'],
    enabled: false,
  },
];

function webNotif(title, body) {
  if (Platform.OS !== 'web' || !('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/favicon.ico' });
}

function nowHHMM() {
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

export default function RemindersScreen() {
  const { mc, accentColor } = useTheme();
  const [reminders,  setReminders]  = useState(DEFAULT_REMINDERS);
  const [permission, setPermission] = useState('default');
  const [storageKey, setStorageKey] = useState(null);
  const [editing,    setEditing]    = useState(null);
  const [log,        setLog]        = useState([]);
  const [quietFrom,  setQuietFrom]  = useState('23:00');
  const [quietTo,    setQuietTo]    = useState('07:00');
  const intervalsRef = useRef({});

  useEffect(() => {
    if (Platform.OS === 'web' && 'Notification' in window) setPermission(Notification.permission);
    getUser().then(async u => {
      const key = 'tg_reminders2_' + u;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.reminders) setReminders(d.reminders);
        if (d.log)       setLog(d.log);
        if (d.quietFrom) setQuietFrom(d.quietFrom);
        if (d.quietTo)   setQuietTo(d.quietTo);
      }
    });
    return () => { Object.values(intervalsRef.current).forEach(clearInterval); };
  }, []);

  async function persist(newReminders, newLog) {
    if (!storageKey) return;
    await AsyncStorage.setItem(storageKey, JSON.stringify({
      reminders: newReminders, log: newLog || log, quietFrom, quietTo,
    }));
  }

  function isQuietHour() {
    const now = nowHHMM();
    if (quietFrom < quietTo) return now >= quietFrom && now < quietTo;
    return now >= quietFrom || now < quietTo;
  }

  function fire(r, msgIdx) {
    const idx = msgIdx == null ? 0 : msgIdx;
    if (isQuietHour()) return;
    const day = new Date().getDay();
    if (!r.days.includes(day)) return;
    const msg = r.type === 'times' ? (r.messages?.[idx] || r.label) : (r.message || r.label);
    webNotif('Too Good', msg);
    const entry = {
      label: r.label, icon: r.icon, msg,
      time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
    };
    setLog(prev => {
      const updated = [entry, ...prev].slice(0, 20);
      return updated;
    });
  }

  function scheduleReminder(r) {
    clearInterval(intervalsRef.current[r.key]);
    if (!r.enabled) return;
    if (r.type === 'interval') {
      intervalsRef.current[r.key] = setInterval(() => fire(r, 0), r.interval * 60 * 1000);
    } else {
      intervalsRef.current[r.key] = setInterval(() => {
        const now = nowHHMM();
        (r.times || []).forEach((t, i) => { if (t === now) fire(r, i); });
      }, 60 * 1000);
    }
  }

  async function toggleReminder(key) {
    const current = reminders.find(r => r.key === key);
    if (!current.enabled) {
      if (Platform.OS === 'web' && 'Notification' in window && Notification.permission !== 'granted') {
        const p = await Notification.requestPermission();
        setPermission(p);
        if (p !== 'granted') return;
      }
    }
    const updated = reminders.map(r => r.key === key ? { ...r, enabled: !r.enabled } : r);
    setReminders(updated);
    scheduleReminder(updated.find(r => r.key === key));
    await persist(updated);
  }

  function updateReminder(key, patch) {
    const updated = reminders.map(r => r.key === key ? { ...r, ...patch } : r);
    setReminders(updated);
    const r = updated.find(r => r.key === key);
    if (r.enabled) scheduleReminder(r);
    persist(updated);
  }

  function toggleDay(key, day) {
    const r = reminders.find(r => r.key === key);
    const days = r.days.includes(day) ? r.days.filter(d => d !== day) : [...r.days, day];
    updateReminder(key, { days });
  }

  const enabledCount = reminders.filter(r => r.enabled).length;
  const webSupported = Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window;

  // Fired-notification counts per reminder, derived from the existing log
  const firedCounts = reminders
    .map(r => ({ label: r.label.slice(0, 6), v: log.filter(entry => entry.label === r.label).length }))
    .filter(d => d.v > 0);

  const s = StyleSheet.create({
    root:   { flex: 1, backgroundColor: mc.bg },
    wrap:   { padding: 20, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:  { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:    { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
    card:   { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14 },
    label:  { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 10 },
    row:    { flexDirection: 'row', alignItems: 'center' },
    reqBtn: { backgroundColor: accentColor, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
    reqTxt: { fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700', letterSpacing: 1 },
    dayBtn: { width: 28, height: 28, borderWidth: 1, borderColor: mc.border, alignItems: 'center', justifyContent: 'center', marginRight: 4, borderRadius: 14 },
    dayBtnA:{ borderWidth: 2 },
    dayTxt: { fontFamily: F.mono, fontSize: 8, color: mc.text3 },
    input:  { borderWidth: 1, borderColor: mc.border, padding: 8, fontFamily: F.mono, fontSize: 12, color: mc.text, flex: 1 },
    timeTag:{ backgroundColor: mc.border + '66', paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginBottom: 4 },
    logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: mc.border },
  });

  const timeInputStyle = {
    backgroundColor: 'transparent', color: mc.text, fontFamily: F.mono,
    fontSize: 13, border: '1px solid ' + mc.border, padding: 8, flex: 1,
  };

  return (
    <ScrollView style={s.root} keyboardShouldPersistTaps="handled">
      <View style={s.wrap}>
        <Text style={s.title}>Reminders</Text>
        <Text style={s.sub}>SMART HEALTH NOTIFICATIONS</Text>

        {webSupported && permission !== 'granted' && permission !== 'denied' && (
          <TouchableOpacity style={s.reqBtn} onPress={async () => {
            const p = await Notification.requestPermission(); setPermission(p);
          }}>
            <Text style={s.reqTxt}>ALLOW NOTIFICATIONS</Text>
          </TouchableOpacity>
        )}
        {webSupported && permission === 'denied' && (
          <View style={[s.card, { borderColor: '#E57373' + '44' }]}>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#E57373', lineHeight: 18 }}>
              Notifications blocked. Open browser Settings → Site permissions → Notifications → Allow for this site.
            </Text>
          </View>
        )}

        {/* Status + quiet hours */}
        <View style={[s.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }]}>
          <View>
            <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text }}>
              {enabledCount} reminder{enabledCount !== 1 ? 's' : ''} active
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 2 }}>
              {permission === 'granted' ? 'Notifications allowed ✓' : 'Notifications not enabled'}
            </Text>
          </View>
          <View>
            <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, marginBottom: 6, letterSpacing: 1 }}>QUIET HOURS (NO ALERTS)</Text>
            <View style={[s.row, { gap: 8 }]}>
              {React.createElement('input', { type: 'time', value: quietFrom,
                onChange: e => { setQuietFrom(e.target.value); persist(reminders); },
                style: { ...timeInputStyle, width: 90 } })}
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>to</Text>
              {React.createElement('input', { type: 'time', value: quietTo,
                onChange: e => { setQuietTo(e.target.value); persist(reminders); },
                style: { ...timeInputStyle, width: 90 } })}
            </View>
          </View>
        </View>

        {/* Activation summary */}
        <View style={s.card}>
          <Text style={s.label}>REMINDER ACTIVATION</Text>
          <StatBar
            label="ENABLED"
            value={enabledCount}
            max={reminders.length}
            color={accentColor}
            mc={mc}
            displayValue={`${enabledCount}/${reminders.length}`}
          />
          {firedCounts.length > 0 && (
            <>
              <Text style={[s.label, { marginTop: 10 }]}>NOTIFICATIONS FIRED (RECENT LOG)</Text>
              <BarChart data={firedCounts} color={accentColor} mc={mc} height={70} />
            </>
          )}
        </View>

        {/* Reminder cards */}
        {reminders.map(r => {
          const isEditing = editing === r.key;
          return (
            <View key={r.key} style={[s.card, r.enabled && { borderColor: r.color + '55' }]}>
              {/* Header */}
              <View style={[s.row, { justifyContent: 'space-between', marginBottom: r.enabled ? 10 : 0 }]}>
                <View style={[s.row, { flex: 1 }]}>
                  {!!r.icon && r.icon !== '—' && <Text style={{ fontSize: 16, marginRight: 8 }}>{r.icon}</Text>}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text }}>{r.label}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{r.desc}</Text>
                  </View>
                </View>
                <Switch value={r.enabled} onValueChange={() => toggleReminder(r.key)}
                  thumbColor={r.enabled ? r.color : mc.border}
                  trackColor={{ false: mc.border, true: r.color + '55' }} />
              </View>

              {/* Summary when enabled */}
              {r.enabled && !isEditing && (
                <View>
                  <View style={[s.row, { flexWrap: 'wrap', marginBottom: 8 }]}>
                    {r.type === 'interval'
                      ? <View style={s.timeTag}><Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>Every {r.interval >= 60 ? r.interval/60 + 'h' : r.interval + 'm'} · {r.activeFrom}–{r.activeTo}</Text></View>
                      : (r.times || []).map(t => <View key={t} style={s.timeTag}><Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{t}</Text></View>)
                    }
                  </View>
                  <View style={[s.row, { marginBottom: 10 }]}>
                    {DAYS_SHORT.map((d, i) => (
                      <View key={i} style={[s.dayBtn, r.days.includes(i) && { ...s.dayBtnA, borderColor: r.color, backgroundColor: r.color + '22' }]}>
                        <Text style={[s.dayTxt, r.days.includes(i) && { color: r.color }]}>{d}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={[s.row, { gap: 10 }]}>
                    <TouchableOpacity onPress={() => setEditing(r.key)}
                      style={{ borderWidth: 1, borderColor: mc.border, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>Edit schedule</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => fire(r, 0)}
                      style={{ borderWidth: 1, borderColor: r.color + '55', paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: r.color }}>Test notification</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Edit panel */}
              {isEditing && (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: mc.border }}>
                  {r.type === 'interval' && (
                    <>
                      <Text style={[s.label, { marginBottom: 6 }]}>INTERVAL (MINUTES)</Text>
                      <View style={[s.row, { gap: 8, marginBottom: 14 }]}>
                        {[30, 60, 90, 120, 180].map(v => (
                          <TouchableOpacity key={v} onPress={() => updateReminder(r.key, { interval: v })}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1,
                              borderColor: r.interval === v ? r.color : mc.border,
                              backgroundColor: r.interval === v ? r.color + '22' : 'transparent' }}>
                            <Text style={{ fontFamily: F.mono, fontSize: 10, color: r.interval === v ? r.color : mc.text3 }}>
                              {v >= 60 ? v/60 + 'h' : v + 'm'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={[s.label, { marginBottom: 6 }]}>ACTIVE HOURS</Text>
                      <View style={[s.row, { gap: 8, marginBottom: 14 }]}>
                        {React.createElement('input', { type: 'time', value: r.activeFrom,
                          onChange: e => updateReminder(r.key, { activeFrom: e.target.value }),
                          style: timeInputStyle })}
                        <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3 }}>to</Text>
                        {React.createElement('input', { type: 'time', value: r.activeTo,
                          onChange: e => updateReminder(r.key, { activeTo: e.target.value }),
                          style: timeInputStyle })}
                      </View>
                    </>
                  )}
                  {r.type === 'times' && (
                    <>
                      <Text style={[s.label, { marginBottom: 6 }]}>REMINDER TIMES</Text>
                      {(r.times || []).map((t, i) => (
                        <View key={i} style={[s.row, { gap: 8, marginBottom: 8 }]}>
                          {React.createElement('input', { type: 'time', value: t,
                            onChange: e => {
                              const times = [...r.times]; times[i] = e.target.value;
                              updateReminder(r.key, { times });
                            }, style: timeInputStyle })}
                          {r.times.length > 1 && (
                            <TouchableOpacity onPress={() => {
                              const times = r.times.filter((_, j) => j !== i);
                              const messages = (r.messages || []).filter((_, j) => j !== i);
                              updateReminder(r.key, { times, messages });
                            }}>
                              <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#C85A6E" strokeWidth={2.2} strokeLinecap="round">
                                <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
                              </Svg>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                      <TouchableOpacity onPress={() =>
                        updateReminder(r.key, {
                          times: [...(r.times || []), '09:00'],
                          messages: [...(r.messages || []), r.label],
                        })
                      } style={{ borderWidth: 1, borderColor: r.color + '55', paddingVertical: 8, alignItems: 'center', marginBottom: 14 }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 10, color: r.color }}>+ Add another time</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <Text style={[s.label, { marginBottom: 6 }]}>ACTIVE DAYS</Text>
                  <View style={[s.row, { marginBottom: 16 }]}>
                    {DAYS_SHORT.map((d, i) => (
                      <TouchableOpacity key={i}
                        style={[s.dayBtn, r.days.includes(i) && { ...s.dayBtnA, borderColor: r.color, backgroundColor: r.color + '22' }]}
                        onPress={() => toggleDay(r.key, i)}>
                        <Text style={[s.dayTxt, r.days.includes(i) && { color: r.color }]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => setEditing(null)}
                    style={{ backgroundColor: r.color, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#0A0A0A', fontWeight: '700' }}>DONE</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {/* Recent fired log */}
        {log.length > 0 && (
          <View style={s.card}>
            <Text style={s.label}>RECENT NOTIFICATIONS</Text>
            {log.slice(0, 8).map((entry, i) => (
              <View key={i} style={s.logRow}>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text, flex: 1 }}>{entry.msg}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{entry.time}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.card}>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, lineHeight: 18 }}>
            Reminders only fire while this browser tab is open.{'\n'}
            For persistent background alerts, use your phone's native reminder app alongside this one.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
