import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, TextInput, Modal, Alert,
} from 'react-native';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { getSegments, createSegment, getSegmentDetail, logEffort, deleteSegment } from '../api';
import { getToken, getUser } from '../auth';

// ─── constants ────────────────────────────────────────────────────────────────

const CATS = [
  { v: 'all',     l: 'All' },
  { v: 'run',     l: 'Run' },
  { v: 'gym',     l: 'Gym' },
  { v: 'cycle',   l: 'Cycle' },
  { v: 'swim',    l: 'Swim' },
  { v: 'general', l: 'General' },
];

const CATEGORY_LABELS = {
  run:     'Run',
  gym:     'Gym',
  cycle:   'Cycle',
  swim:    'Swim',
  general: 'General',
};

const METRIC_OPTIONS = [
  { v: 'time',     l: 'Time — fastest wins (minutes)' },
  { v: 'reps',     l: 'Reps / Count — most wins' },
  { v: 'distance', l: 'Distance — furthest wins (km)' },
];

const METRIC_SUB = {
  time:     'Enter your time. Fastest time wins.',
  reps:     'Enter your rep count. Most wins.',
  distance: 'Enter distance in km. Furthest wins.',
};

const METRIC_LABEL = {
  time:     'Time (minutes)',
  reps:     'Reps',
  distance: 'Distance (km)',
};

// ─── main component ───────────────────────────────────────────────────────────

export default function SegmentsScreen({ navigation }) {
  const { mc, accentColor } = useTheme();

  const [segs,        setSegs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('all');
  const [activeId,    setActiveId]    = useState(null);
  const [detail,      setDetail]      = useState(null);
  const [detailLoad,  setDetailLoad]  = useState(false);
  const [me,          setMe]          = useState('');

  // create modal
  const [showCreate,  setShowCreate]  = useState(false);
  const [csName,      setCsName]      = useState('');
  const [csDesc,      setCsDesc]      = useState('');
  const [csCat,       setCsCat]       = useState('run');
  const [csMetric,    setCsMetric]    = useState('time');
  const [creating,    setCreating]    = useState(false);

  // log effort modal
  const [showLog,     setShowLog]     = useState(false);
  const [effortVal,   setEffortVal]   = useState('');
  const [effortNote,  setEffortNote]  = useState('');
  const [logging,     setLogging]     = useState(false);

  // ── load ────────────────────────────────────────────────────────────────────

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

  // ── filtered list ────────────────────────────────────────────────────────────

  const filtered = filter === 'all' ? segs : segs.filter(s => s.category === filter);

  // ── create ───────────────────────────────────────────────────────────────────

  function openCreate() {
    setCsName(''); setCsDesc(''); setCsCat('run'); setCsMetric('time');
    setShowCreate(true);
  }

  async function submitCreate() {
    if (!csName.trim()) { Alert.alert('Enter a segment name'); return; }
    setCreating(true);
    const d = await createSegment({
      name: csName.trim(),
      description: csDesc.trim(),
      category: csCat,
      metric: csMetric,
    });
    setCreating(false);
    if (d?.ok) {
      setShowCreate(false);
      await init();
      await loadDetail(d.segment_id);
    }
  }

  // ── log effort ───────────────────────────────────────────────────────────────

  function openLog() {
    setEffortVal(''); setEffortNote('');
    setShowLog(true);
  }

  async function submitEffort() {
    const val = parseFloat(effortVal);
    if (!val || val <= 0) { Alert.alert('Enter a valid value'); return; }
    setLogging(true);
    const d = await logEffort(detail.segment.id, {
      value: val,
      note: effortNote.trim() || undefined,
    });
    setLogging(false);
    if (d?.ok) {
      setShowLog(false);
      if (d.is_kom) Alert.alert('King of the Segment!', `You now hold the record with ${d.fmt}`);
      else          Alert.alert('Logged!', `${d.fmt}${d.rank ? ` · Rank #${d.rank}` : ''}`);
      await init();
      await loadDetail(detail.segment.id);
    }
  }

  // ── delete ───────────────────────────────────────────────────────────────────

  function handleDelete() {
    Alert.alert('Delete segment?', 'This will delete all efforts too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteSegment(detail.segment.id);
          setActiveId(null);
          setDetail(null);
          await init();
        },
      },
    ]);
  }

  // ── render: left panel segment row ──────────────────────────────────────────

  function SegRow({ s }) {
    const isActive = s.id === activeId;
    return (
      <TouchableOpacity
        style={[st.segItem, isActive && st.segItemSel]}
        onPress={() => loadDetail(s.id)}
        activeOpacity={0.7}
      >
        <View style={st.segTop}>
          <Text style={st.segCatPill}>{CATEGORY_LABELS[s.category] || s.category}</Text>
          <Text style={st.segName} numberOfLines={1}>{s.name}</Text>
        </View>
        <Text style={st.segMeta}>
          {s.athlete_count} athlete{s.athlete_count !== 1 ? 's' : ''}
          {' · '}{s.effort_count} effort{s.effort_count !== 1 ? 's' : ''}
          {' · '}{s.metric_unit}
        </Text>
      </TouchableOpacity>
    );
  }

  // ── render: detail pane ──────────────────────────────────────────────────────

  function DetailPane() {
    if (!activeId && !detailLoad) {
      return (
        <View style={st.emptyState}>
          <Text style={st.emptyText}>Select a segment to view its leaderboard.</Text>
          <Text style={st.emptyText}>Create one to challenge everyone on the app.</Text>
          <Text style={st.emptyHint}>
            Segments are workout challenges — fastest time, most reps, or longest distance wins.
          </Text>
        </View>
      );
    }

    if (detailLoad) {
      return (
        <View style={st.emptyState}>
          <ActivityIndicator color={accentColor} />
        </View>
      );
    }

    if (!detail) {
      return (
        <View style={st.emptyState}>
          <Text style={st.emptyText}>Not found.</Text>
        </View>
      );
    }

    const { segment: seg, kom, my_pb, board, my_history, is_mine } = detail;

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 32 }} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={st.segHero}>
          <View style={{ flex: 1 }}>
            <Text style={st.segHeroName}>{seg.name}</Text>
            <Text style={st.segHeroMeta}>
              {seg.cat_label}{'  ·  '}Measured by: {seg.metric_label}
            </Text>
            {!!seg.description && (
              <Text style={[st.segHeroMeta, { marginTop: 4 }]}>{seg.description}</Text>
            )}
          </View>
          <View style={st.segHeroActions}>
            <TouchableOpacity style={st.btnLog} onPress={openLog}>
              <Text style={st.btnLogText}>+ LOG EFFORT</Text>
            </TouchableOpacity>
            {is_mine && (
              <TouchableOpacity onPress={handleDelete}>
                <Text style={st.btnDel}>Delete segment</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* KOM banner */}
        {kom && (
          <View style={st.komBanner}>
            <View style={{ flex: 1 }}>
              <Text style={st.komLabel}>King of the Segment</Text>
              <Text style={st.komName}>{kom.name}</Text>
            </View>
            <Text style={st.komPb}>{kom.pb_fmt}</Text>
          </View>
        )}

        {/* Two-col layout: leaderboard left, PB + history right */}
        <View style={st.detailCols}>

          {/* Left col: leaderboard */}
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={S.sectionHead}>Leaderboard — Personal Bests</Text>
            {board && board.length > 0 ? board.map((b, i) => {
              const rankStr = b.rank === 1 ? '1' : b.rank === 2 ? '2' : b.rank === 3 ? '3' : String(b.rank);
              const isMe    = b.username === me;
              return (
                <View key={b.username || i} style={[st.lbRow, i === board.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={[st.lbRank, b.rank <= 3 && { color: accentColor }]}>{rankStr}</Text>
                  <Text style={[st.lbName, isMe && { color: accentColor, fontWeight: '700' }]} numberOfLines={1}>
                    {b.name || ('@' + b.username)}
                  </Text>
                  <Text style={st.lbVal}>{b.pb_fmt}</Text>
                  <Text style={st.lbDate}>{b.last_at}</Text>
                </View>
              );
            }) : (
              <Text style={[st.noDataText]}>No efforts yet — be first!</Text>
            )}
          </View>

          {/* Right col: PB card + history */}
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
              {my_history && my_history.length > 0 ? my_history.map((h, i) => (
                <View key={i} style={[st.histRow, i === my_history.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={st.histVal}>{h.fmt}</Text>
                  <Text style={st.histNote} numberOfLines={1}>{h.note || ''}</Text>
                  <Text style={st.histDate}>{h.at}</Text>
                </View>
              )) : (
                <Text style={st.noDataText}>No efforts logged yet.</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  // ── main render ──────────────────────────────────────────────────────────────

  const st = StyleSheet.create({
    // layout
    outerRow:        { flex: 1, flexDirection: 'row' },

    // left panel
    leftPanel:       { width: 280, borderRightWidth: 1, borderColor: mc.border, backgroundColor: mc.sidebar, flexDirection: 'column' },
    lpHead:          { padding: 20, paddingTop: 24, paddingBottom: 14, borderBottomWidth: 1, borderColor: mc.border },
    lpTitle:         { fontFamily: F.serif, fontSize: 20, color: mc.text, marginBottom: 12 },
    btnCreate:       { paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(201,168,76,0.45)', alignItems: 'center' },
    btnCreateText:   { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: accentColor },

    // filter row
    filterRow:       { borderBottomWidth: 1, borderColor: mc.border, flexGrow: 0 },
    filterRowContent:{ paddingHorizontal: 14, paddingVertical: 10, gap: 4, flexDirection: 'row', flexWrap: 'wrap' },
    filterBtn:       { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: mc.border },
    filterBtnA:      { borderColor: 'rgba(201,168,76,0.5)', backgroundColor: mc.goldDim },
    filterTxt:       { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: mc.text3 },

    // segment list items
    listHint:        { padding: 16, fontSize: 11, color: mc.text3, fontFamily: F.mono },
    segItem:         { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: mc.border },
    segItemSel:      { backgroundColor: mc.goldDim },
    segTop:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    segCatPill:      { fontSize: 10, color: accentColor, fontFamily: F.mono, letterSpacing: 0.5 },
    segName:         { flex: 1, fontSize: 13, color: mc.text, fontFamily: F.mono },
    segMeta:         { fontSize: 10, color: mc.text3, fontFamily: F.mono, letterSpacing: 0.3 },

    // detail pane: empty / loading state
    emptyState:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
    emptyText:       { fontFamily: F.mono, fontSize: 13, color: mc.text3, textAlign: 'center', lineHeight: 28, marginBottom: 4 },
    emptyHint:       { fontFamily: F.mono, fontSize: 11, color: mc.text3, textAlign: 'center', marginTop: 8, lineHeight: 20 },

    // hero card
    segHero:         { flexDirection: 'row', alignItems: 'flex-start', gap: 20, padding: 28, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, marginBottom: 20 },
    segHeroName:     { fontFamily: F.serif, fontSize: 26, color: mc.text, marginBottom: 6 },
    segHeroMeta:     { fontSize: 11, color: mc.text3, fontFamily: F.mono, lineHeight: 20 },
    segHeroActions:  { marginLeft: 'auto', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 },
    btnLog:          { paddingVertical: 10, paddingHorizontal: 22, backgroundColor: accentColor },
    btnLogText:      { fontFamily: F.mono, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#0A0A0A', fontWeight: '700' },
    btnDel:          { fontSize: 10, color: mc.text3, fontFamily: F.mono, letterSpacing: 1 },

    // KOM banner
    komBanner:       { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18, paddingHorizontal: 24, borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)', backgroundColor: 'rgba(201,168,76,0.05)', marginBottom: 20 },
    komLabel:        { fontSize: 10, color: accentColor, letterSpacing: 3, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 3 },
    komName:         { fontFamily: F.serif, fontSize: 20, color: mc.text },
    komPb:           { fontFamily: F.serif, fontSize: 22, color: accentColor, marginLeft: 'auto' },

    // two-col layout
    detailCols:      { flexDirection: 'row', gap: 16 },

    // leaderboard
    lbRow:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderColor: mc.border },
    lbRank:          { width: 24, fontSize: 14, color: mc.text3, fontFamily: F.mono, textAlign: 'center', flexShrink: 0 },
    lbName:          { flex: 1, fontSize: 12, color: mc.text, fontFamily: F.mono },
    lbVal:           { fontFamily: F.serif, fontSize: 14, color: mc.text2 },
    lbDate:          { fontSize: 10, color: mc.text3, fontFamily: F.mono },

    // PB card
    pbCard:          { padding: 16, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, alignItems: 'center', marginBottom: 16 },
    pbLabel:         { fontSize: 10, color: mc.text3, letterSpacing: 3, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 6 },
    pbVal:           { fontFamily: F.serif, fontSize: 28, color: accentColor, marginBottom: 4 },
    pbRank:          { fontSize: 12, color: mc.text2, fontFamily: F.mono },

    // history panel
    panelBox:        { padding: 20, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border },
    histRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderColor: mc.border },
    histVal:         { fontFamily: F.serif, fontSize: 15, color: accentColor },
    histNote:        { flex: 1, fontSize: 11, color: mc.text3, fontFamily: F.mono },
    histDate:        { fontSize: 10, color: mc.text3, fontFamily: F.mono },
    noDataText:      { fontSize: 11, color: mc.text3, fontFamily: F.mono, paddingVertical: 8 },

    // modals
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

    // create modal: category + metric pickers
    catGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    catBtn:          { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: mc.border },
    catBtnA:         { borderColor: mc.borderH, backgroundColor: mc.goldDim },
    catTxt:          { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
    radioRow:        { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: mc.border, marginBottom: 6 },
    radioDot:        { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: mc.text3, marginRight: 10, flexShrink: 0 },
    radioLabel:      { fontFamily: F.mono, fontSize: 12, color: mc.text2 },
  });

  return (
    <View style={S.screen}>

      {/* Two-panel layout */}
      <View style={st.outerRow}>

        {/* Left panel */}
        <View style={st.leftPanel}>
          {/* Header */}
          <View style={st.lpHead}>
            <Text style={st.lpTitle}>Segments</Text>
            <TouchableOpacity style={st.btnCreate} onPress={openCreate}>
              <Text style={st.btnCreateText}>+ Create Segment</Text>
            </TouchableOpacity>
          </View>

          {/* Category filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={st.filterRow}
            contentContainerStyle={st.filterRowContent}
          >
            {CATS.map(c => (
              <TouchableOpacity
                key={c.v}
                style={[st.filterBtn, filter === c.v && st.filterBtnA]}
                onPress={() => setFilter(c.v)}
              >
                <Text style={[st.filterTxt, filter === c.v && { color: accentColor }]}>{c.l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Segment list */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {loading ? (
              <Text style={st.listHint}>Loading…</Text>
            ) : filtered.length === 0 ? (
              <Text style={st.listHint}>
                {filter === 'all' ? 'No segments yet — create one!' : 'No segments in this category.'}
              </Text>
            ) : (
              filtered.map(s => <SegRow key={String(s.id)} s={s} />)
            )}
          </ScrollView>
        </View>

        {/* Main detail panel */}
        <View style={{ flex: 1 }}>
          <DetailPane />
        </View>
      </View>

      {/* ── Log Effort Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showLog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLog(false)}
      >
        <TouchableOpacity
          style={st.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowLog(false)}
        >
          <TouchableOpacity style={st.modalBox} activeOpacity={1} onPress={() => {}}>
            <Text style={st.modalTitle}>
              Log Effort{detail?.segment ? ` — ${detail.segment.name}` : ''}
            </Text>
            <Text style={st.modalSub}>
              {detail?.segment ? METRIC_SUB[detail.segment.metric] || '' : ''}
            </Text>

            <Text style={S.label}>
              {detail?.segment ? METRIC_LABEL[detail.segment.metric] || 'Value' : 'Value'}
            </Text>
            <TextInput
              style={st.formInp}
              value={effortVal}
              onChangeText={setEffortVal}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={mc.text3}
              autoFocus
            />

            <Text style={[S.label, { marginTop: 2 }]}>Note (optional)</Text>
            <TextInput
              style={st.formInp}
              value={effortNote}
              onChangeText={setEffortNote}
              placeholder="How did it go?"
              placeholderTextColor={mc.text3}
              maxLength={100}
            />

            <View style={st.modalBtns}>
              <TouchableOpacity style={st.btnCancel} onPress={() => setShowLog(false)}>
                <Text style={st.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.btnSubmit} onPress={submitEffort} disabled={logging}>
                {logging
                  ? <ActivityIndicator size="small" color="#0A0A0A" />
                  : <Text style={st.btnSubmitText}>Log It</Text>
                }
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Create Segment Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <TouchableOpacity
          style={st.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowCreate(false)}
        >
          <TouchableOpacity style={st.modalBox} activeOpacity={1} onPress={() => {}}>
            <Text style={st.modalTitle}>Create a Segment</Text>

            <Text style={S.label}>Name</Text>
            <TextInput
              style={st.formInp}
              value={csName}
              onChangeText={setCsName}
              placeholder="e.g. 5km Morning Run"
              placeholderTextColor={mc.text3}
              maxLength={50}
              autoFocus
            />

            <Text style={[S.label, { marginTop: 2 }]}>Description (optional)</Text>
            <TextInput
              style={st.formInp}
              value={csDesc}
              onChangeText={setCsDesc}
              placeholder="What is this segment?"
              placeholderTextColor={mc.text3}
              maxLength={120}
            />

            <Text style={[S.label, { marginTop: 2 }]}>Category</Text>
            <View style={st.catGrid}>
              {CATS.filter(c => c.v !== 'all').map(c => (
                <TouchableOpacity
                  key={c.v}
                  style={[st.catBtn, csCat === c.v && st.catBtnA]}
                  onPress={() => setCsCat(c.v)}
                >
                  <Text style={[st.catTxt, csCat === c.v && { color: accentColor }]}>{c.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[S.label, { marginTop: 14 }]}>Measure by</Text>
            {METRIC_OPTIONS.map(m => (
              <TouchableOpacity
                key={m.v}
                style={[st.radioRow, csMetric === m.v && { borderColor: mc.borderH }]}
                onPress={() => setCsMetric(m.v)}
              >
                <View style={[st.radioDot, csMetric === m.v && { backgroundColor: accentColor, borderColor: accentColor }]} />
                <Text style={st.radioLabel}>{m.l}</Text>
              </TouchableOpacity>
            ))}

            <View style={[st.modalBtns, { marginTop: 20 }]}>
              <TouchableOpacity style={st.btnCancel} onPress={() => setShowCreate(false)}>
                <Text style={st.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.btnSubmit} onPress={submitCreate} disabled={creating}>
                {creating
                  ? <ActivityIndicator size="small" color="#0A0A0A" />
                  : <Text style={st.btnSubmitText}>Create</Text>
                }
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

