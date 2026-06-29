import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { getScore, getActivity, getBuddies, getAchievements, sendBuddyReq, respondBuddy } from '../api';
import { getToken, getUser } from '../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtNumber(n) {
  return Math.round(n || 0).toLocaleString('en-US');
}

function fmtJoined(iso) {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T12:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function fmtEventTime(iso) {
  if (!iso) return '';
  return iso.replace('T', ' ').slice(0, 16);
}

const EVENT_LABELS = {
  login:        'Checked in',
  food_log:     'Logged meals',
  calorie_goal: 'Hit calorie goal',
  exercise:     'Completed workout',
  blood_report: 'Analyzed blood report',
};

// ── component ─────────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  // My own profile data
  const [myUsername,   setMyUsername]   = useState('');
  const [score,        setScore]        = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [buddies,      setBuddies]      = useState([]);
  const [feed,         setFeed]         = useState([]);

  // Buddy-action UI state (own profile only — for now showing own profile)
  // buddy_status not applicable on own profile; kept for future param-based use
  const [loadingScore, setLoadingScore] = useState(true);
  const [loadingAch,   setLoadingAch]   = useState(true);
  const [loadingFeed,  setLoadingFeed]  = useState(true);
  const [selectedAch,  setSelectedAch]  = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const u = await getUser();
    setMyUsername(u || '');

    // Load score
    setLoadingScore(true);
    try {
      const s = await getScore();
      if (s?.ok) setScore(s);
    } finally {
      setLoadingScore(false);
    }

    // Load achievements
    setLoadingAch(true);
    try {
      const a = await getAchievements();
      if (a?.ok) setAchievements(a.achievements || []);
    } finally {
      setLoadingAch(false);
    }

    // Load buddies count
    try {
      const b = await getBuddies();
      if (b?.ok) setBuddies(b.buddies || []);
    } catch (_) {}

    // Load activity feed (own score events)
    setLoadingFeed(true);
    try {
      const d = await getScore();
      if (d?.ok) setFeed(d.events || []);
    } finally {
      setLoadingFeed(false);
    }
  }

  // ── derived ────────────────────────────────────────────────────────────────

  const targetName     = score?.name || myUsername;
  const targetUsername = score?.username || myUsername;
  const targetGoal     = score?.goal || '';
  const targetJoined   = score?.member_since ? fmtJoined(score.member_since) : '';
  const targetLevel    = score?.level ?? 0;
  const targetXP       = score?.total_xp ?? 0;
  const targetStreak   = score?.streak ?? 0;
  const buddyCount     = buddies.length;
  const initial        = (targetName[0] || '?').toUpperCase();

  // ── render ─────────────────────────────────────────────────────────────────

  const st = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: mc.bg,
  },
  container: {
    paddingTop: 44,
    paddingHorizontal: 56,
    paddingBottom: 60,
    maxWidth: 900,
  },

  // page label
  pageLabel: {
    fontFamily: F.mono,
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 3.36,
    textTransform: 'uppercase',
    marginBottom: 28,
  },

  // hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
    paddingVertical: 32,
    paddingHorizontal: 36,
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
    marginBottom: 24,
  },
  heroAv: {
    width: 72,
    height: 72,
    backgroundColor: mc.goldDim,
    borderWidth: 1,
    borderColor: mc.borderH,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroAvTxt: {
    fontFamily: F.display,
    fontSize: 38,
    color: accentColor,
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontFamily: F.serif,
    fontSize: 28,
    color: mc.text,
    marginBottom: 6,
    fontWeight: '400',
  },
  heroMeta: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text3,
    letterSpacing: 0.7,
    lineHeight: 20,
  },

  // stats row
  statsRow: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    paddingVertical: 20,
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
    alignItems: 'center',
  },
  statBorderRight: {
    // gap already handles spacing via gap:2 — no extra border needed
  },
  statVal: {
    fontFamily: F.serif,
    fontSize: 28,
    color: accentColor,
    marginBottom: 4,
    fontWeight: '400',
  },
  statLbl: {
    fontFamily: F.mono,
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 1.96,
    textTransform: 'uppercase',
  },

  // section head
  sectionHead: {
    fontFamily: F.mono,
    fontSize: 11,
    color: mc.text3,
    letterSpacing: 2.52,
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: mc.border,
  },

  // achievements
  achGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  achBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
  },
  achEmojiBox: {
    width: 28,
    height: 28,
    backgroundColor: mc.goldDim,
    borderWidth: 1,
    borderColor: mc.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achEmojiTxt: {
    fontFamily: F.display,
    fontSize: 14,
    color: accentColor,
  },
  achInfo: {
    flexDirection: 'column',
  },
  achTitle: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text,
    letterSpacing: 0.56,
  },
  achDate: {
    fontFamily: F.mono,
    fontSize: 9,
    color: mc.text3,
  },

  achModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achModal: {
    backgroundColor: mc.elevated,
    borderWidth: 1,
    width: 300,
    padding: 28,
    alignItems: 'center',
  },
  achModalIcon: {
    width: 56,
    height: 56,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  achModalTitle: {
    fontFamily: F.display,
    fontSize: 18,
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  achModalDesc: {
    fontFamily: F.mono,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  achModalDivider: {
    width: '100%',
    height: 1,
    marginBottom: 12,
  },
  achModalMeta: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  achModalClose: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderWidth: 1,
  },
  achModalCloseTxt: {
    fontFamily: F.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // feed
  feedList: {
    flexDirection: 'column',
    gap: 2,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
  },
  fiIconBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fiIconTxt: {
    fontFamily: F.mono,
    fontSize: 14,
    color: mc.text2,
  },
  fiLabelWrap: {
    flex: 1,
  },
  fiLabel: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text,
  },
  fiXp: {
    fontFamily: F.serif,
    fontSize: fontSize,
    color: accentColor,
    marginRight: 6,
    fontWeight: '400',
  },
  fiTime: {
    fontFamily: F.mono,
    fontSize: 10,
    color: mc.text3,
  },

  // misc
  loadingTxt: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text3,
    marginBottom: 12,
  },
  emptyTxt: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text3,
    marginBottom: 12,
  },
  feedEmpty: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
});

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={st.container}
    >
      {/* page-label */}
      <Text style={st.pageLabel}>Your Profile</Text>

      {/* ── hero ── */}
      <View style={st.hero}>
        {/* avatar */}
        <View style={st.heroAv}>
          <Text style={st.heroAvTxt}>{initial}</Text>
        </View>

        {/* name / meta */}
        <View style={st.heroInfo}>
          <Text style={st.heroName}>{targetName}</Text>
          <Text style={st.heroMeta}>@{targetUsername}</Text>
          {targetGoal ? (
            <Text style={st.heroMeta}>Goal: {targetGoal}</Text>
          ) : null}
          {targetJoined ? (
            <Text style={st.heroMeta}>Member since {targetJoined}</Text>
          ) : null}
        </View>

        {/* hero action — own profile: nothing shown */}
      </View>

      {/* ── stats row ── */}
      <View style={st.statsRow}>
        <View style={[st.statBox, st.statBorderRight]}>
          <Text style={st.statVal}>{targetLevel}</Text>
          <Text style={st.statLbl}>Level</Text>
        </View>
        <View style={[st.statBox, st.statBorderRight]}>
          <Text style={st.statVal}>{fmtNumber(targetXP)}</Text>
          <Text style={st.statLbl}>Total XP</Text>
        </View>
        <View style={[st.statBox, st.statBorderRight]}>
          <Text style={st.statVal}>{targetStreak}</Text>
          <Text style={st.statLbl}>Day Streak</Text>
        </View>
        <View style={st.statBox}>
          <Text style={st.statVal}>{buddyCount}</Text>
          <Text style={st.statLbl}>Buddies</Text>
        </View>
      </View>

      {/* ── achievements ── */}
      <Text style={st.sectionHead}>Achievements</Text>
      {loadingAch ? (
        <Text style={st.loadingTxt}>Loading...</Text>
      ) : achievements.length === 0 ? (
        <Text style={st.emptyTxt}>No achievements yet.</Text>
      ) : (
        <View style={st.achGrid}>
          {achievements.map((a, i) => (
            <TouchableOpacity key={a.badge || i} style={st.achBadge} onPress={() => setSelectedAch(a)} activeOpacity={0.75}>
              <View style={st.achEmojiBox}>
                <Text style={st.achEmojiTxt}>{(a.title || '?')[0].toUpperCase()}</Text>
              </View>
              <View style={st.achInfo}>
                <Text style={st.achTitle}>{a.title}</Text>
                <Text style={st.achDate}>{(a.earned_at || '').slice(0, 10)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── achievement detail modal ── */}
      <Modal visible={!!selectedAch} transparent animationType="fade" onRequestClose={() => setSelectedAch(null)}>
        <TouchableOpacity style={st.achModalOverlay} activeOpacity={1} onPress={() => setSelectedAch(null)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={[st.achModal, { borderRadius, borderColor: mc.borderH }]}>
            <View style={[st.achModalIcon, { backgroundColor: mc.goldDim, borderColor: mc.borderH }]}>
              <Text style={[st.achEmojiTxt, { fontSize: 22 }]}>{(selectedAch?.title || '?')[0].toUpperCase()}</Text>
            </View>
            <Text style={[st.achModalTitle, { color: accentColor }]}>{selectedAch?.title}</Text>
            <Text style={[st.achModalDesc, { color: mc.text2 }]}>{selectedAch?.desc || 'Achievement unlocked.'}</Text>
            <View style={[st.achModalDivider, { backgroundColor: mc.border }]} />
            <Text style={[st.achModalMeta, { color: mc.text3 }]}>Earned on {(selectedAch?.earned_at || '').slice(0, 10)}</Text>
            <TouchableOpacity style={[st.achModalClose, { borderColor: mc.border }]} onPress={() => setSelectedAch(null)}>
              <Text style={[st.achModalCloseTxt, { color: mc.text2 }]}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── recent activity ── */}
      <Text style={[st.sectionHead, { marginTop: 28 }]}>Recent Activity</Text>
      {loadingFeed ? (
        <Text style={st.loadingTxt}>Loading...</Text>
      ) : feed.length === 0 ? (
        <View style={st.feedEmpty}>
          <Text style={st.emptyTxt}>No activity yet.</Text>
        </View>
      ) : (
        <View style={st.feedList}>
          {feed.map((e, i) => {
            const tp    = e.event_type || e.type || '';
            const label = EVENT_LABELS[tp] || tp;
            const xp    = Math.round(e.xp_awarded || e.xp || 0);
            const at    = fmtEventTime(e.awarded_at || e.at || '');
            return (
              <View key={i} style={st.feedItem}>
                {/* icon placeholder — letter of event type */}
                <View style={st.fiIconBox}>
                  <Text style={st.fiIconTxt}>{(tp[0] || '*').toUpperCase()}</Text>
                </View>
                <View style={st.fiLabelWrap}>
                  <Text style={st.fiLabel}>{label}</Text>
                </View>
                <Text style={st.fiXp}>+{xp} XP</Text>
                <Text style={st.fiTime}>{at}</Text>
              </View>
            );
          })}
        </View>
      )}

    </ScrollView>
  );
}

