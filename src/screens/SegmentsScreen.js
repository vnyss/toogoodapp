import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { getSegments, createSegment, getSegmentDetail, logEffort, deleteSegment } from '../api';
import { getUser } from '../auth';

// ─── helpers ──────────────────────────────────────────────────────────────────

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPace(minPerKm) {
  if (!minPerKm || !isFinite(minPerKm) || minPerKm > 60) return '--:--';
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── constants ────────────────────────────────────────────────────────────────

const CATS = [
  { v: 'all',     l: 'All',     emoji: '' },
  { v: 'run',     l: 'Run',     emoji: '🏃' },
  { v: 'gym',     l: 'Gym',     emoji: '🏋️' },
  { v: 'cycle',   l: 'Cycle',   emoji: '🚴' },
  { v: 'swim',    l: 'Swim',    emoji: '🏊' },
  { v: 'general', l: 'General', emoji: '⚡' },
];

const GPS_CATS = new Set(['run', 'cycle', 'swim']);

const CAT_VERB = { run: 'Run', cycle: 'Ride', swim: 'Swim', gym: 'Workout', general: 'Activity' };

const METRIC_OPTIONS = [
  { v: 'time',     l: 'Time — fastest wins (minutes)' },
  { v: 'reps',     l: 'Reps / Count — most wins' },
  { v: 'distance', l: 'Distance — furthest wins (km)' },
];

// ─── Leaflet map component (web-only) ─────────────────────────────────────────

function LiveMap({ coords, currentPos, style }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const polyRef = useRef(null);
  const markerRef = useRef(null);
  const initRef = useRef(false);

  // Load Leaflet once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) { initRef.current = false; return; }

    if (!document.getElementById('tg-leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'tg-leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('tg-leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'tg-leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      document.head.appendChild(script);
    }
  }, []);

  // Init map when div mounts
  useEffect(() => {
    const tryInit = () => {
      if (!divRef.current || !window.L || mapRef.current) return;
      const L = window.L;
      const center = currentPos ? [currentPos.lat, currentPos.lng] : [20, 77];
      const map = L.map(divRef.current, { center, zoom: 15, zoomControl: true, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      polyRef.current = L.polyline([], { color: '#C9A84C', weight: 5, opacity: 0.9 }).addTo(map);
      mapRef.current = map;
    };
    const iv = setInterval(() => { if (window.L) { clearInterval(iv); tryInit(); } }, 200);
    return () => { clearInterval(iv); };
  }, []);

  // Update map with new coords
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    const latlngs = coords.map(c => [c.lat, c.lng]);
    polyRef.current?.setLatLngs(latlngs);

    if (currentPos) {
      if (!markerRef.current) {
        markerRef.current = L.circleMarker([currentPos.lat, currentPos.lng], {
          radius: 10, fillColor: '#C9A84C', color: '#fff', weight: 2, fillOpacity: 1,
        }).addTo(mapRef.current);
      } else {
        markerRef.current.setLatLng([currentPos.lat, currentPos.lng]);
      }
      mapRef.current.setView([currentPos.lat, currentPos.lng]);
    }
  }, [coords, currentPos]);

  return React.createElement('div', {
    ref: divRef,
    style: {
      width: '100%',
      height: '100%',
      backgroundColor: '#111',
      ...style,
    },
  });
}

// ─── GPS Activity Tracker fullscreen modal ────────────────────────────────────

function ActivityTracker({ visible, segment, onSave, onClose }) {
  const { mc, accentColor } = useTheme();
  const [phase, setPhase]     = useState('ready'); // ready | active | paused | finished
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [coords, setCoords]   = useState([]);
  const [currentPos, setCurrentPos] = useState(null);
  const [gpsError, setGpsError] = useState('');

  const watchRef     = useRef(null);
  const timerRef     = useRef(null);
  const startRef     = useRef(null);
  const pausedRef    = useRef(0); // accumulated paused seconds

  const isGps  = GPS_CATS.has(segment?.category);
  const verb   = CAT_VERB[segment?.category] || 'Activity';
  const metric = segment?.metric || 'time';

  const pace  = (distance > 0.01 && elapsed > 0) ? (elapsed / 60 / distance) : 0;
  const speed = elapsed > 0 ? (distance / elapsed * 3600) : 0;

  // Reset on open
  useEffect(() => {
    if (visible) {
      setPhase('ready'); setElapsed(0); setDistance(0);
      setCoords([]); setCurrentPos(null); setGpsError('');
      pausedRef.current = 0;
    } else {
      stopAll();
    }
  }, [visible]);

  function stopAll() {
    if (watchRef.current) { navigator.geolocation?.clearWatch(watchRef.current); watchRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function startActivity() {
    if (isGps && !navigator.geolocation) {
      setGpsError('GPS not supported in this browser. Use Chrome or Firefox.');
      return;
    }
    startRef.current = Date.now();
    setPhase('active');

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000) - pausedRef.current);
    }, 1000);

    if (isGps) {
      watchRef.current = navigator.geolocation.watchPosition(
        pos => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setCurrentPos({ lat, lng });
          setCoords(prev => {
            const next = [...prev, { lat, lng }];
            if (next.length >= 2) {
              const last = next[next.length - 2];
              setDistance(d => d + haversine(last.lat, last.lng, lat, lng));
            }
            return next;
          });
        },
        err => setGpsError('GPS error: ' + err.message),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
      );
    }
  }

  function finishActivity() {
    stopAll();
    setPhase('finished');
  }

  function handleSave() {
    let value, note;
    if (metric === 'distance') {
      value = parseFloat(distance.toFixed(2));
    } else if (metric === 'time') {
      value = parseFloat((elapsed / 60).toFixed(1));
    } else {
      value = elapsed;
    }
    note = isGps
      ? `${distance.toFixed(2)} km · ${formatTime(elapsed)}${pace > 0 ? ` · ${formatPace(pace)}/km` : ''}`
      : `${formatTime(elapsed)}`;
    onSave({ value, note });
  }

  const st = StyleSheet.create({
    root:      { flex: 1, backgroundColor: '#0A0A0A' },
    header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 48, backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#222' },
    headerTxt: { fontFamily: F.mono, fontSize: 12, color: C.text2, letterSpacing: 4 },
    closeBtn:  { padding: 8 },
    closeTxt:  { fontFamily: F.mono, fontSize: 18, color: C.text2 },
    mapWrap:   { flex: 1, position: 'relative', overflow: 'hidden' },
    noMapBox:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
    noMapTxt:  { fontFamily: F.mono, fontSize: 12, color: '#444', letterSpacing: 2 },
    statsBar:  { backgroundColor: '#0A0A0A', borderTopWidth: 1, borderTopColor: '#222', padding: 24, paddingBottom: 0 },
    statsRow:  { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
    statBox:   { alignItems: 'center', minWidth: 90 },
    statVal:   { fontFamily: F.serif, fontSize: 32, color: accentColor, lineHeight: 38 },
    statUnit:  { fontFamily: F.mono, fontSize: 10, color: '#555', letterSpacing: 2, marginTop: 2 },
    bigBtn:    { marginHorizontal: 24, marginBottom: 24, paddingVertical: 18, alignItems: 'center', backgroundColor: accentColor },
    bigBtnTxt: { fontFamily: F.mono, fontSize: 14, letterSpacing: 3, color: '#0A0A0A', fontWeight: '700', textTransform: 'uppercase' },
    stopBtn:   { backgroundColor: '#C05050' },
    stopBtnTxt:{ color: '#fff' },
    saveBtn:   { backgroundColor: accentColor },
    resultBox: { padding: 32, alignItems: 'center', gap: 8 },
    resultTtl: { fontFamily: F.serif, fontSize: 26, color: C.text, marginBottom: 8 },
    resultStat:{ fontFamily: F.mono, fontSize: 14, color: C.text2, letterSpacing: 1 },
    errTxt:    { fontFamily: F.mono, fontSize: 11, color: '#C05050', textAlign: 'center', padding: 12 },
    readyBox:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 48 },
    readyTtl:  { fontFamily: F.serif, fontSize: 28, color: C.text },
    readySub:  { fontFamily: F.mono, fontSize: 12, color: C.text3, textAlign: 'center', letterSpacing: 1 },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={st.root}>
        <View style={st.header}>
          <Text style={st.headerTxt}>START {verb.toUpperCase()}</Text>
          <TouchableOpacity onPress={() => { stopAll(); onClose(); }} style={st.closeBtn}>
            <Text style={st.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        {phase === 'ready' && (
          <View style={st.readyBox}>
            <Text style={st.readyTtl}>{segment?.name || verb}</Text>
            <Text style={st.readySub}>
              {isGps
                ? `GPS will track your ${verb.toLowerCase()} route, distance and pace in real time.`
                : `Time your ${verb.toLowerCase()} and log your result.`}
            </Text>
            {!!gpsError && <Text style={st.errTxt}>{gpsError}</Text>}
            <TouchableOpacity style={[st.bigBtn, { marginHorizontal: 0, marginBottom: 0, minWidth: 220 }]} onPress={startActivity}>
              <Text style={st.bigBtnTxt}>▶  Start {verb}</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'active' && (
          <>
            {isGps ? (
              <View style={st.mapWrap}>
                <LiveMap coords={coords} currentPos={currentPos} />
              </View>
            ) : (
              <View style={st.noMapBox}>
                <Text style={st.noMapTxt}>{verb.toUpperCase()} IN PROGRESS</Text>
              </View>
            )}

            <View style={st.statsBar}>
              <View style={st.statsRow}>
                {isGps && (
                  <View style={st.statBox}>
                    <Text style={st.statVal}>{distance.toFixed(2)}</Text>
                    <Text style={st.statUnit}>KM</Text>
                  </View>
                )}
                <View style={st.statBox}>
                  <Text style={st.statVal}>{formatTime(elapsed)}</Text>
                  <Text style={st.statUnit}>TIME</Text>
                </View>
                {isGps && segment?.category !== 'swim' && (
                  <View style={st.statBox}>
                    <Text style={st.statVal}>{formatPace(pace)}</Text>
                    <Text style={st.statUnit}>MIN/KM</Text>
                  </View>
                )}
                {isGps && segment?.category === 'cycle' && (
                  <View style={st.statBox}>
                    <Text style={[st.statVal, { fontSize: 24 }]}>{speed.toFixed(1)}</Text>
                    <Text style={st.statUnit}>KM/H</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={[st.bigBtn, st.stopBtn]} onPress={finishActivity}>
                <Text style={[st.bigBtnTxt, st.stopBtnTxt]}>■  Stop {verb}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {phase === 'finished' && (
          <ScrollView contentContainerStyle={st.resultBox}>
            <Text style={st.resultTtl}>{verb} Finished</Text>
            {isGps && <Text style={st.resultStat}>Distance  {distance.toFixed(2)} km</Text>}
            <Text style={st.resultStat}>Time  {formatTime(elapsed)}</Text>
            {isGps && pace > 0 && segment?.category !== 'swim' && (
              <Text style={st.resultStat}>Avg Pace  {formatPace(pace)} /km</Text>
            )}
            {isGps && segment?.category === 'cycle' && (
              <Text style={st.resultStat}>Avg Speed  {speed.toFixed(1)} km/h</Text>
            )}
            <TouchableOpacity style={[st.bigBtn, { marginTop: 24, marginHorizontal: 0, minWidth: 220 }]} onPress={handleSave}>
              <Text style={st.bigBtnTxt}>Save to Leaderboard</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Mini static map (shows route in detail panel) ───────────────────────────

function RouteMap({ coords, style }) {
  const divRef  = useRef(null);
  const mapRef  = useRef(null);

  useEffect(() => {
    const tryInit = () => {
      if (!divRef.current || !window.L || mapRef.current) return;
      if (!coords?.length) return;
      const L = window.L;
      const center = [coords[0].lat, coords[0].lng];
      const map = L.map(divRef.current, { center, zoom: 14, zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      const line = L.polyline(coords.map(c => [c.lat, c.lng]), { color: '#C9A84C', weight: 4 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [20, 20] });
      mapRef.current = map;
    };
    const iv = setInterval(() => { if (window.L) { clearInterval(iv); tryInit(); } }, 200);
    return () => { clearInterval(iv); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [coords]);

  if (!coords?.length) return null;
  return React.createElement('div', { ref: divRef, style: { width: '100%', height: 200, borderRadius: 4, overflow: 'hidden', ...style } });
}

// ─── main component ───────────────────────────────────────────────────────────

export default function SegmentsScreen({ navigation }) {
  const { mc, accentColor } = useTheme();

  const [segs,       setSegs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('all');
  const [activeId,   setActiveId]   = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [detailLoad, setDetailLoad] = useState(false);
  const [me,         setMe]         = useState('');

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [csName,     setCsName]     = useState('');
  const [csDesc,     setCsDesc]     = useState('');
  const [csCat,      setCsCat]      = useState('run');
  const [csMetric,   setCsMetric]   = useState('time');
  const [creating,   setCreating]   = useState(false);

  // log effort modal (manual)
  const [showLog,    setShowLog]    = useState(false);
  const [effortVal,  setEffortVal]  = useState('');
  const [effortNote, setEffortNote] = useState('');
  const [logging,    setLogging]    = useState(false);

  // GPS tracker
  const [showTracker, setShowTracker] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    const u = await getUser();
    setMe(u?.username || u || '');
    const d = await getSegments();
    if (d?.ok) setSegs(d.segments || []);
    setLoading(false);
  }

  async function loadDetail(id) {
    setActiveId(id);
    setDetail(null);
    setDetailLoad(true);
    const d = await getSegmentDetail(id);
    if (d?.ok) setDetail(d);
    setDetailLoad(false);
  }

  const filtered = filter === 'all' ? segs : segs.filter(s => s.category === filter);

  function openCreate() {
    setCsName(''); setCsDesc(''); setCsCat('run'); setCsMetric('time');
    setShowCreate(true);
  }

  async function submitCreate() {
    if (!csName.trim()) return;
    setCreating(true);
    const d = await createSegment({ name: csName.trim(), description: csDesc.trim(), category: csCat, metric: csMetric });
    setCreating(false);
    if (d?.ok) {
      setShowCreate(false);
      await init();
      await loadDetail(d.segment_id);
      // Auto-open tracker for GPS categories
      if (GPS_CATS.has(csCat)) setShowTracker(true);
    }
  }

  function openLog() { setEffortVal(''); setEffortNote(''); setShowLog(true); }

  async function submitEffort() {
    const val = parseFloat(effortVal);
    if (!val || val <= 0) return;
    setLogging(true);
    const d = await logEffort(detail.segment.id, { value: val, note: effortNote.trim() || undefined });
    setLogging(false);
    if (d?.ok) {
      setShowLog(false);
      await init();
      await loadDetail(detail.segment.id);
    }
  }

  async function handleTrackerSave({ value, note }) {
    setShowTracker(false);
    if (!detail?.segment) return;
    const d = await logEffort(detail.segment.id, { value, note });
    if (d?.ok) {
      await init();
      await loadDetail(detail.segment.id);
    }
  }

  async function handleDelete() {
    if (!window.confirm?.('Delete this segment and all its efforts?')) return;
    await deleteSegment(detail.segment.id);
    setActiveId(null); setDetail(null);
    await init();
  }

  // ── styles ─────────────────────────────────────────────────────────────────

  const st = StyleSheet.create({
    outerRow:        { flex: 1, flexDirection: 'row' },

    leftPanel:       { width: 280, borderRightWidth: 1, borderColor: mc.border, backgroundColor: mc.sidebar, flexDirection: 'column' },
    lpHead:          { padding: 20, paddingTop: 24, paddingBottom: 14, borderBottomWidth: 1, borderColor: mc.border },
    lpTitle:         { fontFamily: F.serif, fontSize: 20, color: mc.text, marginBottom: 12 },
    btnCreate:       { paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(201,168,76,0.45)', alignItems: 'center' },
    btnCreateText:   { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: accentColor },

    filterRow:       { borderBottomWidth: 1, borderColor: mc.border, flexGrow: 0 },
    filterContent:   { paddingHorizontal: 14, paddingVertical: 10, gap: 4, flexDirection: 'row', flexWrap: 'wrap' },
    filterBtn:       { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: mc.border },
    filterBtnA:      { borderColor: 'rgba(201,168,76,0.5)', backgroundColor: mc.goldDim },
    filterTxt:       { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: mc.text3 },

    segItem:         { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: mc.border },
    segItemSel:      { backgroundColor: mc.goldDim },
    segTop:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    segCatPill:      { fontSize: 10, color: accentColor, fontFamily: F.mono, letterSpacing: 0.5 },
    segName:         { flex: 1, fontSize: 13, color: mc.text, fontFamily: F.mono },
    segMeta:         { fontSize: 10, color: mc.text3, fontFamily: F.mono, letterSpacing: 0.3 },

    emptyState:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
    emptyIcon:       { fontFamily: F.serif, fontSize: 40, color: mc.text3, marginBottom: 16 },
    emptyText:       { fontFamily: F.mono, fontSize: 13, color: mc.text3, textAlign: 'center', lineHeight: 28 },
    emptyHint:       { fontFamily: F.mono, fontSize: 11, color: mc.text3, textAlign: 'center', marginTop: 8, lineHeight: 20 },

    detailScroll:    { flex: 1 },
    detailContent:   { padding: 32 },

    segHero:         { flexDirection: 'row', alignItems: 'flex-start', gap: 20, padding: 28, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, marginBottom: 20 },
    segHeroName:     { fontFamily: F.serif, fontSize: 26, color: mc.text, marginBottom: 6 },
    segHeroMeta:     { fontSize: 11, color: mc.text3, fontFamily: F.mono, lineHeight: 20 },
    segHeroActions:  { marginLeft: 'auto', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 },
    btnStart:        { paddingVertical: 10, paddingHorizontal: 22, backgroundColor: accentColor, flexDirection: 'row', alignItems: 'center', gap: 8 },
    btnStartText:    { fontFamily: F.mono, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#0A0A0A', fontWeight: '700' },
    btnLog:          { paddingVertical: 10, paddingHorizontal: 22, borderWidth: 1, borderColor: 'rgba(201,168,76,0.5)' },
    btnLogText:      { fontFamily: F.mono, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: accentColor },
    btnDel:          { fontSize: 10, color: mc.text3, fontFamily: F.mono, letterSpacing: 1 },

    komBanner:       { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18, paddingHorizontal: 24, borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)', backgroundColor: 'rgba(201,168,76,0.05)', marginBottom: 20 },
    komLabel:        { fontSize: 10, color: accentColor, letterSpacing: 3, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 3 },
    komName:         { fontFamily: F.serif, fontSize: 20, color: mc.text },
    komPb:           { fontFamily: F.serif, fontSize: 22, color: accentColor, marginLeft: 'auto' },

    detailCols:      { flexDirection: 'row', gap: 16 },

    lbRow:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderColor: mc.border },
    lbRank:          { width: 24, fontSize: 14, color: mc.text3, fontFamily: F.mono, textAlign: 'center', flexShrink: 0 },
    lbName:          { flex: 1, fontSize: 12, color: mc.text, fontFamily: F.mono },
    lbVal:           { fontFamily: F.serif, fontSize: 14, color: mc.text2 },
    lbDate:          { fontSize: 10, color: mc.text3, fontFamily: F.mono },

    pbCard:          { padding: 16, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, alignItems: 'center', marginBottom: 16 },
    pbLabel:         { fontSize: 10, color: mc.text3, letterSpacing: 3, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 6 },
    pbVal:           { fontFamily: F.serif, fontSize: 28, color: accentColor, marginBottom: 4 },
    pbRank:          { fontSize: 12, color: mc.text2, fontFamily: F.mono },

    panelBox:        { padding: 20, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border },
    histRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderColor: mc.border },
    histVal:         { fontFamily: F.serif, fontSize: 15, color: accentColor },
    histNote:        { flex: 1, fontSize: 11, color: mc.text3, fontFamily: F.mono },
    histDate:        { fontSize: 10, color: mc.text3, fontFamily: F.mono },
    noData:          { fontSize: 11, color: mc.text3, fontFamily: F.mono, paddingVertical: 8 },

    modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
    modalBox:        { backgroundColor: mc.elevated, borderWidth: 1, borderColor: mc.borderH, padding: 32, minWidth: 360, maxWidth: 440, width: '100%' },
    modalTitle:      { fontFamily: F.serif, fontSize: 20, color: mc.text, marginBottom: 4 },
    modalSub:        { fontSize: 11, color: mc.text3, fontFamily: F.mono, marginBottom: 20, lineHeight: 18 },
    formInp:         { width: '100%', backgroundColor: mc.bg, borderWidth: 1, borderColor: mc.border, color: mc.text, paddingVertical: 9, paddingHorizontal: 12, fontFamily: F.mono, fontSize: 13, marginBottom: 14, outlineWidth: 0 },
    modalBtns:       { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
    btnCancel:       { paddingVertical: 9, paddingHorizontal: 18, borderWidth: 1, borderColor: mc.border },
    btnCancelText:   { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    btnSubmit:       { paddingVertical: 9, paddingHorizontal: 18, backgroundColor: accentColor, alignItems: 'center', minWidth: 80 },
    btnSubmitText:   { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#0A0A0A', fontWeight: '700' },

    catGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    catBtn:          { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: mc.border },
    catBtnA:         { borderColor: mc.borderH, backgroundColor: mc.goldDim },
    catTxt:          { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    radioRow:        { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: mc.border, marginBottom: 6 },
    radioDot:        { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: mc.text3, marginRight: 10, flexShrink: 0 },
    radioLabel:      { fontFamily: F.mono, fontSize: 12, color: mc.text2 },
  });

  // ── segment row ─────────────────────────────────────────────────────────────

  function SegRow({ s }) {
    const isActive = s.id === activeId;
    const cat = CATS.find(c => c.v === s.category);
    return (
      <TouchableOpacity style={[st.segItem, isActive && st.segItemSel]} onPress={() => loadDetail(s.id)} activeOpacity={0.7}>
        <View style={st.segTop}>
          <Text style={st.segCatPill}>{cat?.emoji} {cat?.l || s.category}</Text>
          <Text style={st.segName} numberOfLines={1}>{s.name}</Text>
        </View>
        <Text style={st.segMeta}>
          {s.athlete_count} athlete{s.athlete_count !== 1 ? 's' : ''} · {s.effort_count} effort{s.effort_count !== 1 ? 's' : ''} · {s.metric_unit}
        </Text>
      </TouchableOpacity>
    );
  }

  // ── detail pane ──────────────────────────────────────────────────────────────

  function DetailPane() {
    if (!activeId && !detailLoad) {
      return (
        <View style={st.emptyState}>
          <Text style={st.emptyIcon}>⚡</Text>
          <Text style={st.emptyText}>Select a segment to view its leaderboard</Text>
          <Text style={st.emptyHint}>
            Segments are workout challenges — fastest time,{'\n'}most reps, or longest distance wins.
          </Text>
        </View>
      );
    }
    if (detailLoad) return <View style={st.emptyState}><ActivityIndicator color={accentColor} /></View>;
    if (!detail)    return <View style={st.emptyState}><Text style={st.emptyText}>Could not load segment.</Text></View>;

    const { segment: seg, kom, my_pb, board, my_history, is_mine } = detail;
    const isGps  = GPS_CATS.has(seg.category);
    const verb   = CAT_VERB[seg.category] || 'Activity';
    const cat    = CATS.find(c => c.v === seg.category);

    return (
      <ScrollView style={st.detailScroll} contentContainerStyle={st.detailContent} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={st.segHero}>
          <View style={{ flex: 1 }}>
            <Text style={st.segHeroName}>{seg.name}</Text>
            <Text style={st.segHeroMeta}>{cat?.emoji} {seg.cat_label}  ·  Measured by: {seg.metric_label}</Text>
            {!!seg.description && <Text style={[st.segHeroMeta, { marginTop: 4 }]}>{seg.description}</Text>}
          </View>
          <View style={st.segHeroActions}>
            {isGps ? (
              <TouchableOpacity style={st.btnStart} onPress={() => setShowTracker(true)}>
                <Text style={st.btnStartText}>▶ Start {verb}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={st.btnLog} onPress={openLog}>
                <Text style={st.btnLogText}>+ Log Effort</Text>
              </TouchableOpacity>
            )}
            {isGps && (
              <TouchableOpacity style={st.btnLog} onPress={openLog}>
                <Text style={st.btnLogText}>+ Manual Entry</Text>
              </TouchableOpacity>
            )}
            {is_mine && (
              <TouchableOpacity onPress={handleDelete}>
                <Text style={st.btnDel}>Delete segment</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* KOM */}
        {kom && (
          <View style={st.komBanner}>
            <View style={{ flex: 1 }}>
              <Text style={st.komLabel}>👑 {isGps ? 'King of the Segment' : 'Top Performer'}</Text>
              <Text style={st.komName}>{kom.name}</Text>
            </View>
            <Text style={st.komPb}>{kom.pb_fmt}</Text>
          </View>
        )}

        {/* Two-col layout */}
        <View style={st.detailCols}>

          {/* Leaderboard */}
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={S.sectionHead}>Leaderboard — Personal Bests</Text>
            {board?.length > 0 ? board.map((b, i) => {
              const isMe = b.username === me;
              return (
                <View key={b.username || i} style={[st.lbRow, i === board.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={[st.lbRank, b.rank <= 3 && { color: accentColor }]}>
                    {b.rank === 1 ? '🥇' : b.rank === 2 ? '🥈' : b.rank === 3 ? '🥉' : b.rank}
                  </Text>
                  <Text style={[st.lbName, isMe && { color: accentColor, fontWeight: '700' }]} numberOfLines={1}>
                    {b.name || ('@' + b.username)}
                  </Text>
                  <Text style={st.lbVal}>{b.pb_fmt}</Text>
                  <Text style={st.lbDate}>{b.last_at}</Text>
                </View>
              );
            }) : (
              <Text style={st.noData}>No efforts yet — be first!</Text>
            )}
          </View>

          {/* PB card + history */}
          <View style={{ width: 220 }}>
            {my_pb && (
              <View style={st.pbCard}>
                <Text style={st.pbLabel}>Your Personal Best</Text>
                <Text style={st.pbVal}>{my_pb.pb_fmt}</Text>
                <Text style={st.pbRank}>Rank #{my_pb.rank}</Text>
              </View>
            )}
            <View style={st.panelBox}>
              <Text style={S.sectionHead}>Your History</Text>
              {my_history?.length > 0 ? my_history.map((h, i) => (
                <View key={i} style={[st.histRow, i === my_history.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={st.histVal}>{h.fmt}</Text>
                  <Text style={st.histNote} numberOfLines={1}>{h.note || ''}</Text>
                  <Text style={st.histDate}>{h.at}</Text>
                </View>
              )) : (
                <Text style={st.noData}>No efforts logged yet.</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  // ── main render ──────────────────────────────────────────────────────────────

  return (
    <View style={S.screen}>
      <View style={st.outerRow}>

        {/* Left panel */}
        <View style={st.leftPanel}>
          <View style={st.lpHead}>
            <Text style={st.lpTitle}>Segments</Text>
            <TouchableOpacity style={st.btnCreate} onPress={openCreate}>
              <Text style={st.btnCreateText}>+ Create Segment</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterRow} contentContainerStyle={st.filterContent}>
            {CATS.map(c => (
              <TouchableOpacity key={c.v} style={[st.filterBtn, filter === c.v && st.filterBtnA]} onPress={() => setFilter(c.v)}>
                <Text style={[st.filterTxt, filter === c.v && { color: accentColor }]}>{c.l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ActivityIndicator color={accentColor} />
              </View>
            ) : filtered.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: F.serif, fontSize: 28, color: mc.text3 }}>⚡</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, textAlign: 'center', letterSpacing: 1 }}>
                  {filter === 'all' ? 'No segments yet' : `No ${filter} segments`}
                </Text>
              </View>
            ) : (
              filtered.map(s => <SegRow key={String(s.id)} s={s} />)
            )}
          </ScrollView>
        </View>

        {/* Detail panel */}
        <View style={{ flex: 1 }}>
          <DetailPane />
        </View>
      </View>

      {/* GPS Activity Tracker */}
      <ActivityTracker
        visible={showTracker}
        segment={detail?.segment || null}
        onSave={handleTrackerSave}
        onClose={() => setShowTracker(false)}
      />

      {/* Manual Log Effort Modal */}
      <Modal visible={showLog} transparent animationType="fade" onRequestClose={() => setShowLog(false)}>
        <TouchableOpacity style={st.modalBackdrop} activeOpacity={1} onPress={() => setShowLog(false)}>
          <TouchableOpacity style={st.modalBox} activeOpacity={1} onPress={() => {}}>
            <Text style={st.modalTitle}>Log Effort{detail?.segment ? ` — ${detail.segment.name}` : ''}</Text>
            <Text style={st.modalSub}>{detail?.segment?.metric === 'time' ? 'Enter time in minutes. Fastest wins.' : detail?.segment?.metric === 'reps' ? 'Enter rep count. Most wins.' : 'Enter distance in km. Furthest wins.'}</Text>
            <Text style={S.label}>{detail?.segment?.metric === 'time' ? 'Time (minutes)' : detail?.segment?.metric === 'reps' ? 'Reps' : 'Distance (km)'}</Text>
            <TextInput style={st.formInp} value={effortVal} onChangeText={setEffortVal} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={mc.text3} autoFocus />
            <Text style={[S.label, { marginTop: 2 }]}>Note (optional)</Text>
            <TextInput style={st.formInp} value={effortNote} onChangeText={setEffortNote} placeholder="How did it go?" placeholderTextColor={mc.text3} maxLength={100} />
            <View style={st.modalBtns}>
              <TouchableOpacity style={st.btnCancel} onPress={() => setShowLog(false)}><Text style={st.btnCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={st.btnSubmit} onPress={submitEffort} disabled={logging}>
                {logging ? <ActivityIndicator size="small" color="#0A0A0A" /> : <Text style={st.btnSubmitText}>Log It</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Create Segment Modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <TouchableOpacity style={st.modalBackdrop} activeOpacity={1} onPress={() => setShowCreate(false)}>
          <TouchableOpacity style={st.modalBox} activeOpacity={1} onPress={() => {}}>
            <Text style={st.modalTitle}>Create a Segment</Text>
            <Text style={S.label}>Name</Text>
            <TextInput style={st.formInp} value={csName} onChangeText={setCsName} placeholder="e.g. 5km Morning Run" placeholderTextColor={mc.text3} maxLength={50} autoFocus />
            <Text style={[S.label, { marginTop: 2 }]}>Description (optional)</Text>
            <TextInput style={st.formInp} value={csDesc} onChangeText={setCsDesc} placeholder="What is this segment?" placeholderTextColor={mc.text3} maxLength={120} />
            <Text style={[S.label, { marginTop: 2 }]}>Category</Text>
            <View style={st.catGrid}>
              {CATS.filter(c => c.v !== 'all').map(c => (
                <TouchableOpacity key={c.v} style={[st.catBtn, csCat === c.v && st.catBtnA]} onPress={() => setCsCat(c.v)}>
                  <Text style={[st.catTxt, csCat === c.v && { color: accentColor }]}>{c.emoji} {c.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {GPS_CATS.has(csCat) && (
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor, letterSpacing: 1, marginBottom: 12 }}>
                GPS will track your {CAT_VERB[csCat]?.toLowerCase()} automatically
              </Text>
            )}
            <Text style={[S.label, { marginTop: 2 }]}>Measure by</Text>
            {METRIC_OPTIONS.map(m => (
              <TouchableOpacity key={m.v} style={[st.radioRow, csMetric === m.v && { borderColor: mc.borderH }]} onPress={() => setCsMetric(m.v)}>
                <View style={[st.radioDot, csMetric === m.v && { backgroundColor: accentColor, borderColor: accentColor }]} />
                <Text style={st.radioLabel}>{m.l}</Text>
              </TouchableOpacity>
            ))}
            <View style={[st.modalBtns, { marginTop: 20 }]}>
              <TouchableOpacity style={st.btnCancel} onPress={() => setShowCreate(false)}><Text style={st.btnCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={st.btnSubmit} onPress={submitCreate} disabled={creating}>
                {creating ? <ActivityIndicator size="small" color="#0A0A0A" /> : <Text style={st.btnSubmitText}>{GPS_CATS.has(csCat) ? `Create & Start ${CAT_VERB[csCat]}` : 'Create'}</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}
