import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking } from 'react-native';
import Svg, { Path, Circle, Line, Polyline, Rect } from 'react-native-svg';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import {
  watchStatus, watchSyncGoogleFit, watchSyncGarmin,
  watchDisconnectGoogleFit, watchDisconnectGarmin, watchData,
} from '../api';
import { getToken, getUser } from '../auth';
import { API_BASE } from '../config';

// ── Icons ──────────────────────────────────────────────────────────────────────
function WatchIcon({ color, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={5} y={5} width={14} height={14} rx={7} />
      <Path d="M12 9v3l2 2" />
      <Path d="M9 2l1.5 3" /><Path d="M15 2l-1.5 3" />
      <Path d="M9 22l1.5-3" /><Path d="M15 22l-1.5-3" />
    </Svg>
  );
}

function CheckIcon({ color, size = 14 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

function SyncIcon({ color, size = 13 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 4v6h-6" /><Path d="M1 20v-6h6" />
      <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Svg>
  );
}

function LinkIcon({ color, size = 12 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  );
}

function XIcon({ color, size = 10 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Line x1={18} y1={6} x2={6} y2={18} /><Line x1={6} y1={6} x2={18} y2={18} />
    </Svg>
  );
}

function HeartIcon({ color, size = 13 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  );
}

function MoonIcon({ color, size = 13 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
  );
}

function StepsIcon({ color, size = 13 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </Svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtSleep(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function SyncBadge({ label, value, icon, color }) {
  const { mc } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1, minWidth: 70 }}>
      {icon}
      <Text style={{ fontFamily: F.mono, fontSize: 15, fontWeight: '700', color, marginTop: 6 }}>{value || '—'}</Text>
      <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, marginTop: 2, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}

// ── Provider card ──────────────────────────────────────────────────────────────
function ProviderCard({ provider, info, onConnect, onDisconnect, onSync, syncing, syncedToday, s, mc, accentColor }) {
  const connected = info?.connected;
  const isGarmin  = provider === 'garmin';

  const title = isGarmin ? 'Garmin Connect' : 'Google Fit';
  const desc  = isGarmin
    ? 'Syncs steps, calories, heart rate and sleep from all Garmin wearables.'
    : 'Syncs steps, calories, heart rate and sleep. Works with Mi Band, Noise, boAt and any watch that syncs to Google Fit on Android.';
  const note  = isGarmin
    ? 'Requires a Garmin Developer account. Register free at developer.garmin.com.'
    : null;

  return (
    <View style={s.card}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={[s.providerDot, { backgroundColor: connected ? accentColor : mc.text3 + '40' }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.providerName}>{title}</Text>
          <Text style={s.providerDesc}>{desc}</Text>
          {!!note && <Text style={[s.providerDesc, { color: mc.text3, marginTop: 4 }]}>{note}</Text>}
        </View>
        <View style={[s.statusPill, { backgroundColor: connected ? accentColor + '18' : mc.surface }]}>
          {connected
            ? <CheckIcon color={accentColor} size={10} />
            : <XIcon color={mc.text3} size={9} />}
          <Text style={[s.statusTxt, { color: connected ? accentColor : mc.text3 }]}>
            {connected ? 'LINKED' : 'NOT LINKED'}
          </Text>
        </View>
      </View>

      {/* Today's synced data */}
      {connected && syncedToday && (
        <View style={s.statsRow}>
          <SyncBadge label="STEPS"   value={syncedToday.steps?.toLocaleString()}  icon={<StepsIcon color={accentColor} />}  color={accentColor} />
          <SyncBadge label="SLEEP"   value={fmtSleep(syncedToday.sleep_min)}       icon={<MoonIcon  color='#7C8BF5' />}     color='#7C8BF5' />
          <SyncBadge label="KCAL"    value={syncedToday.calories}                  icon={<StepsIcon color='#E09A4D' />}     color='#E09A4D' />
          <SyncBadge label="HR BPM"  value={syncedToday.heart_rate || '—'}         icon={<HeartIcon color='#C85A6E' />}     color='#C85A6E' />
        </View>
      )}

      {connected && syncedToday?.synced_at && (
        <Text style={s.lastSync}>Last synced · {fmtTime(syncedToday.synced_at)}</Text>
      )}

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {connected ? (
          <>
            <TouchableOpacity style={s.syncBtn} onPress={onSync} disabled={syncing}>
              <SyncIcon color={mc.bg} size={12} />
              <Text style={s.syncBtnTxt}>{syncing ? 'SYNCING…' : 'SYNC NOW'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.disconnectBtn} onPress={onDisconnect}>
              <Text style={s.disconnectBtnTxt}>DISCONNECT</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={s.connectBtn} onPress={onConnect}>
            <LinkIcon color={mc.bg} size={12} />
            <Text style={s.connectBtnTxt}>CONNECT {title.toUpperCase()}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function WatchConnectScreen() {
  const { mc, accentColor } = useTheme();

  const [status,     setStatus]     = useState({});
  const [todayData,  setTodayData]  = useState(null);
  const [syncingGFit, setSyncingGFit] = useState(false);
  const [syncingGarmin, setSyncingGarmin] = useState(false);
  const [syncMsg,    setSyncMsg]    = useState('');
  const [loading,    setLoading]    = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, data] = await Promise.all([
        watchStatus(),
        watchData(today, today),
      ]);
      setStatus(st || {});
      setTodayData((data || []).find(d => d.date === today) || null);
    } catch {}
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  // Handle OAuth redirect back (#watch-connected-* or #watch-error)
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash.startsWith('#watch-connected-')) {
      const provider = hash.replace('#watch-connected-', '');
      setSyncMsg(`${provider === 'google_fit' ? 'Google Fit' : 'Garmin'} connected successfully.`);
      window.history.replaceState(null, '', window.location.pathname);
      load();
    } else if (hash === '#watch-error') {
      setSyncMsg('Connection failed. Please try again.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [load]);

  async function openOAuth(provider) {
    const token = await getToken();
    const url   = `${API_BASE}/api/v1/integrations/${provider}/connect?auth=${token}`;
    if (typeof window !== 'undefined') {
      window.location.href = url;
    } else {
      Linking.openURL(url);
    }
  }

  async function handleSync(provider, setLoading) {
    setLoading(true);
    setSyncMsg('');
    try {
      const fn = provider === 'google_fit' ? watchSyncGoogleFit : watchSyncGarmin;
      const res = await fn(7);
      if (res?.ok) {
        setSyncMsg(`Synced ${res.synced?.length || 0} days from ${provider === 'google_fit' ? 'Google Fit' : 'Garmin'}.`);
        await load();
      } else {
        setSyncMsg(res?.error || 'Sync failed.');
      }
    } catch (e) {
      setSyncMsg('Sync failed. Check your connection.');
    }
    setLoading(false);
  }

  async function handleDisconnect(provider) {
    try {
      const fn = provider === 'google_fit' ? watchDisconnectGoogleFit : watchDisconnectGarmin;
      await fn();
      setSyncMsg(`${provider === 'google_fit' ? 'Google Fit' : 'Garmin'} disconnected.`);
      await load();
    } catch {}
  }

  const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 16, maxWidth: 640, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:   { fontFamily: F.display, fontSize: 22, fontWeight: '600', color: mc.text, marginBottom: 2 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2.5, marginBottom: 24 },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 14, backgroundColor: mc.surface },
    providerDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, marginRight: 12 },
    providerName:{ fontFamily: F.display, fontSize: 15, fontWeight: '600', color: mc.text, marginBottom: 4 },
    providerDesc:{ fontFamily: F.mono, fontSize: 10, color: mc.text2, lineHeight: 16 },
    statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 },
    statusTxt:   { fontFamily: F.mono, fontSize: 9, letterSpacing: 1 },
    statsRow:    { flexDirection: 'row', borderTopWidth: 1, borderTopColor: mc.border, paddingTop: 14, marginBottom: 4, gap: 4 },
    lastSync:    { fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 0.5, marginTop: 4 },
    connectBtn:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: accentColor,
                   paddingVertical: 10, paddingHorizontal: 14, flex: 1 },
    connectBtnTxt: { fontFamily: F.mono, fontSize: 11, fontWeight: '700', color: mc.bg },
    syncBtn:     { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: accentColor,
                   paddingVertical: 9, paddingHorizontal: 14 },
    syncBtnTxt:  { fontFamily: F.mono, fontSize: 11, fontWeight: '700', color: mc.bg },
    disconnectBtn: { paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: mc.border },
    disconnectBtnTxt: { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    msgBox:  { borderWidth: 1, borderColor: accentColor + '40', backgroundColor: accentColor + '0C',
                padding: 12, marginBottom: 14 },
    msgTxt:  { fontFamily: F.mono, fontSize: 11, color: accentColor, lineHeight: 16 },
    infoCard:{ borderWidth: 1, borderColor: mc.border, padding: 14, marginBottom: 14, backgroundColor: mc.surface },
    infoHead:{ fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 2, marginBottom: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
    infoDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: mc.text3, marginTop: 5 },
    infoTxt: { fontFamily: F.mono, fontSize: 11, color: mc.text2, lineHeight: 17, flex: 1 },
  });

  return (
    <ScrollView style={s.root} keyboardShouldPersistTaps="handled">
      <View style={s.content}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          <WatchIcon color={accentColor} size={20} />
          <Text style={s.title}>Watch Connect</Text>
        </View>
        <Text style={s.sub}>WEARABLE INTEGRATIONS</Text>

        {!!syncMsg && (
          <View style={s.msgBox}>
            <Text style={s.msgTxt}>{syncMsg}</Text>
          </View>
        )}

        <ProviderCard
          provider="google_fit"
          info={status.google_fit}
          onConnect={() => openOAuth('google-fit')}
          onDisconnect={() => handleDisconnect('google_fit')}
          onSync={() => handleSync('google_fit', setSyncingGFit)}
          syncing={syncingGFit}
          syncedToday={todayData}
          s={s} mc={mc} accentColor={accentColor}
        />

        <ProviderCard
          provider="garmin"
          info={status.garmin}
          onConnect={() => openOAuth('garmin')}
          onDisconnect={() => handleDisconnect('garmin')}
          onSync={() => handleSync('garmin', setSyncingGarmin)}
          syncing={syncingGarmin}
          syncedToday={todayData}
          s={s} mc={mc} accentColor={accentColor}
        />

        {/* Which watches work */}
        <View style={s.infoCard}>
          <Text style={s.infoHead}>COMPATIBLE DEVICES</Text>
          {[
            { brand: 'Google Fit', detail: 'Mi Band / Xiaomi, Noise, boAt, Fire-Boltt, Samsung Galaxy Watch, Fossil, Wear OS watches — anything that syncs to Google Fit on Android.' },
            { brand: 'Garmin', detail: 'All Garmin wearables — Forerunner, Fenix, Venu, Vivoactive, Vivosmart series and more via Garmin Connect.' },
            { brand: 'Apple Watch', detail: 'Apple Watch syncs to Apple Health on iPhone, not Google Fit. A future iOS companion app will enable this.' },
          ].map(({ brand, detail }) => (
            <View key={brand} style={s.infoRow}>
              <View style={s.infoDot} />
              <Text style={s.infoTxt}>
                <Text style={{ color: mc.text, fontWeight: '600' }}>{brand} — </Text>{detail}
              </Text>
            </View>
          ))}
        </View>

        {/* Setup notes */}
        <View style={s.infoCard}>
          <Text style={s.infoHead}>SETUP NOTES</Text>
          {[
            'Google Fit: Add GOOGLE_FIT_CLIENT_ID and GOOGLE_FIT_CLIENT_SECRET (or reuse GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) in your .env. Enable the Fitness API in Google Cloud Console.',
            'Garmin: Add GARMIN_CLIENT_ID and GARMIN_CLIENT_SECRET. Register a free developer app at developer.garmin.com → Connect IQ → API.',
            'Once connected, tap Sync Now to pull the last 7 days. Step and sleep data will automatically appear in your trackers.',
          ].map((txt, i) => (
            <View key={i} style={s.infoRow}>
              <View style={s.infoDot} />
              <Text style={s.infoTxt}>{txt}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
