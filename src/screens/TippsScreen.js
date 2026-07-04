import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Polygon, Rect, Line, Circle } from 'react-native-svg';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';

// ── Video data ────────────────────────────────────────────────────────────────

const TUTORIALS = [
  { id: 'vc1E5CfRfos', title: 'The Most Effective Science-Based Chest Workout',       channel: 'Jeff Nippard',  duration: '22:14', tag: 'Chest' },
  { id: 'E3Phj5ej9eI', title: 'The Perfect Full Body Workout (Sets & Reps Included)', channel: 'Jeremy Ethier', duration: '17:32', tag: 'Full Body' },
  { id: '9AThycGCakE', title: 'Build Muscle: The Definitive Step-by-Step Guide',      channel: 'AthleanX',      duration: '20:45', tag: 'Muscle' },
  { id: '4vt9C1RON84', title: 'Lose Fat & Build Muscle At The Same Time',             channel: 'Jeff Nippard',  duration: '14:18', tag: 'Fat Loss' },
  { id: 'T7FynUYFOO8', title: 'The Optimal Morning Routine For Fat Loss',             channel: 'Jeremy Ethier', duration: '11:04', tag: 'Nutrition' },
  { id: 'zGAaupFjcl4', title: 'What To Eat Before & After the Gym',                  channel: 'AthleanX',      duration: '16:22', tag: 'Nutrition' },
  { id: 'cbKkB3POqaY', title: 'How To Fix Your Diet: Complete Beginner Guide',        channel: 'Jeff Nippard',  duration: '19:50', tag: 'Nutrition' },
  { id: 'L8fvSOPAjM0', title: 'The Perfect Shoulder Workout (Based On Science)',      channel: 'Jeremy Ethier', duration: '13:27', tag: 'Shoulders' },
  { id: 'v7AYKMP6rOE', title: 'Yoga For Complete Beginners — 20 Min Practice',       channel: 'Yoga w/ Adriene', duration: '26:08', tag: 'Recovery' },
];

const SHORTS = [
  { id: 'A4Oi7yt4bGE', title: '3 tips to grow faster at the gym',      channel: 'Jeff Nippard' },
  { id: 'jcQ4X4Bk8Nc', title: 'Best protein sources ranked',            channel: 'Jeremy Ethier' },
  { id: 'L8fvSOPAjM0', title: 'Why you\'re not getting stronger',       channel: 'AthleanX' },
  { id: 'TzFNa4KDUQU', title: 'Pre-workout meal timing explained',      channel: 'Jeremy Ethier' },
  { id: 'VHrq9ACBmkY', title: 'How much sleep do you actually need?',   channel: 'Huberman Lab' },
  { id: 'j2Z8sD9NKQY', title: 'Perfect squat form in 60 seconds',       channel: 'AthleanX' },
  { id: 'XLR1Zp_J5Jk', title: 'Creatine — what no one tells you',       channel: 'Jeff Nippard' },
  { id: 'IODxDxX7oi4', title: '5-min stretch to fix tight hips',        channel: 'Yoga w/ Adriene' },
];

const ALL_TAGS = ['All', 'Full Body', 'Chest', 'Shoulders', 'Muscle', 'Fat Loss', 'Nutrition', 'Recovery'];

// ── Play icon ─────────────────────────────────────────────────────────────────

function PlayIcon({ size = 36, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={11} fill="rgba(0,0,0,0.55)" />
      <Polygon points="10,8 17,12 10,16" fill={color} />
    </Svg>
  );
}

function CloseIcon({ color, size = 14 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Line x1={18} y1={6} x2={6} y2={18} /><Line x1={6} y1={6} x2={18} y2={18} />
    </Svg>
  );
}

// ── Thumbnail (img via createElement) ─────────────────────────────────────────

function Thumb({ videoId, width, height, borderRadius = 6 }) {
  return React.createElement('img', {
    src: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    width, height,
    style: {
      width, height,
      objectFit: 'cover',
      borderRadius,
      display: 'block',
    },
    alt: '',
  });
}

// ── YouTube embed (iframe via createElement) ───────────────────────────────────

function YouTubeEmbed({ videoId, width, height, borderRadius = 6 }) {
  return React.createElement('iframe', {
    src: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`,
    width, height,
    style: { width, height, border: 'none', borderRadius, display: 'block' },
    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
    allowFullScreen: true,
  });
}

// ── Tutorial card ─────────────────────────────────────────────────────────────

function TutorialCard({ video, onPlay, mc, accentColor, borderRadius, cardWidth }) {
  const thumbH = Math.round(cardWidth * 9 / 16);
  return (
    <TouchableOpacity
      onPress={() => onPlay(video)}
      style={{
        width: cardWidth, borderWidth: 1, borderColor: mc.border,
        borderRadius, overflow: 'hidden', backgroundColor: mc.surface,
      }}
    >
      <View style={{ position: 'relative' }}>
        <Thumb videoId={video.id} width={cardWidth} height={thumbH} borderRadius={0} />
        <View style={{ position: 'absolute', bottom: 6, right: 8 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, color: '#fff', backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 }}>
            {video.duration}
          </Text>
        </View>
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <PlayIcon size={44} color={accentColor} />
        </View>
      </View>
      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 9, color: accentColor, letterSpacing: 2, textTransform: 'uppercase', backgroundColor: accentColor + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 }}>
            {video.tag}
          </Text>
        </View>
        <Text style={{ fontFamily: F.display, fontWeight: '600', fontSize: 13, color: mc.text, lineHeight: 18, marginBottom: 4 }} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1 }}>
          {video.channel}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Short card ────────────────────────────────────────────────────────────────

function ShortCard({ video, onPlay, mc, accentColor, borderRadius }) {
  const W = 160, H = Math.round(W * 16 / 9);
  return (
    <TouchableOpacity
      onPress={() => onPlay(video)}
      style={{
        width: W, borderWidth: 1, borderColor: mc.border,
        borderRadius, overflow: 'hidden', backgroundColor: mc.surface, flexShrink: 0,
      }}
    >
      <View style={{ position: 'relative' }}>
        <Thumb videoId={video.id} width={W} height={H} borderRadius={0} />
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <PlayIcon size={36} color={accentColor} />
        </View>
      </View>
      <View style={{ padding: 10 }}>
        <Text style={{ fontFamily: F.display, fontWeight: '600', fontSize: 11, color: mc.text, lineHeight: 15, marginBottom: 3 }} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 1 }}>
          {video.channel}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Player modal ──────────────────────────────────────────────────────────────

function PlayerModal({ video, isShort, onClose, mc, accentColor, borderRadius }) {
  if (!video) return null;
  const W = isShort ? 360 : 800;
  const H = isShort ? Math.round(W * 16 / 9) : Math.round(W * 9 / 16);
  return (
    <View style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
      alignItems: 'center', justifyContent: 'center', zIndex: 999,
    }}>
      <View style={{ width: W + 32, backgroundColor: mc.surface, borderRadius: borderRadius + 2, overflow: 'hidden', borderWidth: 1, borderColor: mc.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: mc.border }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontFamily: F.display, fontWeight: '700', fontSize: 14, color: mc.text }} numberOfLines={1}>{video.title}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginTop: 2 }}>{video.channel}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <CloseIcon color={mc.text2} size={16} />
          </TouchableOpacity>
        </View>
        <View style={{ padding: 16 }}>
          <YouTubeEmbed videoId={video.id} width={W} height={H} borderRadius={borderRadius} />
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TippsScreen() {
  const { mc, accentColor, accentDim, fontSize, borderRadius } = useTheme();
  const { width } = useWindowDimensions();
  const [tab,        setTab]        = useState('tutorials');
  const [tagFilter,  setTagFilter]  = useState('All');
  const [playing,    setPlaying]    = useState(null);
  const [shortPlay,  setShortPlay]  = useState(null);

  const contentW   = Math.min(width - 240, 1100);
  const cols       = contentW < 600 ? 1 : contentW < 860 ? 2 : 3;
  const gap        = 16;
  const cardW      = Math.floor((contentW - gap * (cols - 1) - 48) / cols);

  const filtered = tagFilter === 'All'
    ? TUTORIALS
    : TUTORIALS.filter(v => v.tag === tagFilter);

  const st = StyleSheet.create({
    screen:   { flex: 1, backgroundColor: mc.bg },
    inner:    { maxWidth: 1100, padding: 24 },
    eyebrow:  { fontFamily: F.mono, fontSize: 10, color: accentColor, letterSpacing: 5, textTransform: 'uppercase', marginBottom: 6 },
    title:    { fontFamily: F.display, fontWeight: '800', fontSize: 32, color: mc.text, letterSpacing: -0.5, marginBottom: 4 },
    sub:      { fontFamily: F.mono, fontSize: 12, color: mc.text3, letterSpacing: 1, marginBottom: 28 },
    tabRow:   { flexDirection: 'row', gap: 4, marginBottom: 20 },
    tab:      { paddingVertical: 8, paddingHorizontal: 18, borderWidth: 1, borderColor: mc.border, borderRadius, backgroundColor: 'transparent' },
    tabActive:{ backgroundColor: accentColor, borderColor: accentColor },
    tabTxt:   { fontFamily: F.mono, fontSize: 11, color: mc.text3, letterSpacing: 2, textTransform: 'uppercase' },
    tabTxtA:  { color: '#080808', fontWeight: '700' },
    filterRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    chip:     { paddingVertical: 5, paddingHorizontal: 12, borderRadius: Math.max(20, borderRadius), borderWidth: 1, borderColor: mc.border },
    chipAct:  { backgroundColor: accentDim, borderColor: accentColor },
    chipTxt:  { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1 },
    chipTxtA: { color: accentColor },
    grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: gap },
    divider:  { height: 1, backgroundColor: mc.border, marginVertical: 28 },
    shortsHdr:{ fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 16 },
  });

  return (
    <View style={st.screen}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>

        {/* Header */}
        <Text style={st.eyebrow}>Learn</Text>
        <Text style={st.title}>Tipps</Text>
        <Text style={st.sub}>Tutorials & shorts from the world's best fitness creators</Text>

        {/* Tabs */}
        <View style={st.tabRow}>
          {[['tutorials','Tutorials'],['shorts','Shorts']].map(([k,l]) => (
            <TouchableOpacity key={k} style={[st.tab, tab===k && st.tabActive]} onPress={() => setTab(k)}>
              <Text style={[st.tabTxt, tab===k && st.tabTxtA]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tutorials tab ── */}
        {tab === 'tutorials' && (
          <>
            {/* Tag filters */}
            <View style={st.filterRow}>
              {ALL_TAGS.map(t => (
                <TouchableOpacity key={t} style={[st.chip, tagFilter===t && st.chipAct]} onPress={() => setTagFilter(t)}>
                  <Text style={[st.chipTxt, tagFilter===t && st.chipTxtA]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Grid */}
            <View style={st.grid}>
              {filtered.map(v => (
                <TutorialCard
                  key={v.id + v.title}
                  video={v}
                  onPlay={setPlaying}
                  mc={mc}
                  accentColor={accentColor}
                  borderRadius={borderRadius}
                  cardWidth={cardW}
                />
              ))}
            </View>
          </>
        )}

        {/* ── Shorts tab ── */}
        {tab === 'shorts' && (
          <>
            <Text style={[st.sub, { marginBottom: 20 }]}>
              Quick tips in under 60 seconds — swipe through the best fitness shorts.
            </Text>
            {/* Horizontal scrollable shorts row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
              {SHORTS.map(v => (
                <ShortCard
                  key={v.id + v.title}
                  video={v}
                  onPlay={setShortPlay}
                  mc={mc}
                  accentColor={accentColor}
                  borderRadius={borderRadius}
                />
              ))}
            </ScrollView>
          </>
        )}

      </ScrollView>

      {/* Tutorial player modal */}
      {playing && (
        <PlayerModal
          video={playing}
          isShort={false}
          onClose={() => setPlaying(null)}
          mc={mc}
          accentColor={accentColor}
          borderRadius={borderRadius}
        />
      )}

      {/* Short player modal */}
      {shortPlay && (
        <PlayerModal
          video={shortPlay}
          isShort={true}
          onClose={() => setShortPlay(null)}
          mc={mc}
          accentColor={accentColor}
          borderRadius={borderRadius}
        />
      )}
    </View>
  );
}
