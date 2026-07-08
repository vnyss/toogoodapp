import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle, Line, Rect, Polygon, Polyline } from 'react-native-svg';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { getScore, leaderboard, getAchievements } from '../api';
import { getToken, getUser } from '../auth';

// ── constants ────────────────────────────────────────────────────────────────
const RING_R    = 48;
const RING_CIRC = 2 * Math.PI * RING_R; // 301.593…

const MILESTONES = [
  { level:   1, title: 'First Step' },
  { level:   5, title: 'Getting Started' },
  { level:  10, title: 'Health Curious' },
  { level:  25, title: 'Consistent' },
  { level:  50, title: 'Committed' },
  { level:  75, title: 'Disciplined' },
  { level: 100, title: 'Century Club' },
  { level: 150, title: 'Half-Way Hero' },
  { level: 200, title: 'Elite Tracker' },
  { level: 250, title: 'Master Tier' },
  { level: 300, title: 'Perfection' },
];

const ACTION_LABELS = {
  login:        'Daily check-in',
  food_log:     'Food logged',
  calorie_goal: 'Calorie goal achieved',
  exercise:     'Exercise logged',
  blood_report: 'Blood report analyzed',
};

function levelTitle(n) {
  if (n >= 300) return 'Perfect';
  if (n >= 250) return 'Grandmaster';
  if (n >= 200) return 'Elite';
  if (n >= 150) return 'Expert';
  if (n >= 100) return 'Advanced';
  if (n >= 75)  return 'Skilled';
  if (n >= 50)  return 'Committed';
  if (n >= 25)  return 'Consistent';
  if (n >= 10)  return 'Curious';
  if (n >= 5)   return 'Beginner';
  return 'Novice';
}

// ── small SVG icon components ─────────────────────────────────────────────────

function IconHome({ color }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  );
}

function IconEdit({ color }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </Svg>
  );
}

function IconActivity({ color }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </Svg>
  );
}

function IconCheck({ color }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <Polyline points="22 4 12 14.01 9 11.01" />
    </Svg>
  );
}

function IconBlood({ color }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      <Circle cx={12} cy={12} r={1} fill={color} />
    </Svg>
  );
}

function IconFire({ color }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z" />
    </Svg>
  );
}

function IconStar({ color }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Svg>
  );
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function ScoreScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  const [score,   setScore]   = useState(null);
  const [lb,      setLb]      = useState(null);
  const [loading, setLoading] = useState(true);

  function loadData() {
    setLoading(true);
    Promise.all([getScore(), leaderboard()])
      .then(([s, l]) => {
        setScore(s?.ok ? s : null);
        setLb(l?.ok ? l : null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // Award daily login XP silently
    const token = getToken ? getToken() : Promise.resolve(null);
    Promise.resolve(token).then(() => {
      import('../api').then(({ awardXP }) => {
        if (awardXP) awardXP('login').catch(() => {});
      }).catch(() => {});
    }).catch(() => {});

    loadData();
  }, []);

  const level      = score?.level ?? 0;
  const maxLevel   = score?.max_level ?? 300;
  const xpInLevel  = score?.xp_in_level ?? 0;
  const xpPerLevel = score?.xp_per_level ?? 1;
  const xpPct      = Math.min(1, xpInLevel / xpPerLevel);
  const dashOffset = RING_CIRC * (1 - (level / maxLevel));
  const multiplier = score?.multiplier ?? 1;

  // leaderboard board array
  const board = lb?.board ?? [];

  // ── styles ──────────────────────────────────────────────────────────────────
  const st = StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: mc.bg,
    },
    container: {
      paddingTop: 32,
      paddingHorizontal: 28,
      paddingBottom: 60,
    },

    // h1 + subtitle
    h1: {
      fontFamily: F.display,
      fontSize: 22,
      fontWeight: '400',
      letterSpacing: 1,
      color: mc.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: fontSize,
      color: mc.text3,
      letterSpacing: 4,
      textTransform: 'uppercase',
      fontFamily: F.mono,
      marginBottom: 32,
    },

    // .level-hero
    levelHero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 28,
      padding: 28,
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
      marginBottom: 24,
    },

    // ring
    ringWrap: {
      width: 110,
      height: 110,
      flexShrink: 0,
      position: 'relative',
    },
    ringCenter: {
      position: 'absolute',
      top: 0, left: 0,
      width: 110,
      height: 110,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    ringLabel: {
      fontSize: 8,
      color: mc.text3,
      letterSpacing: 10,
      textTransform: 'uppercase',
      fontFamily: F.mono,
      marginBottom: 1,
    },
    ringNum: {
      fontFamily: F.serif,   // Playfair Display — as required for large score numbers
      fontSize: 36,
      color: accentColor,
      lineHeight: 40,
    },

    // level info
    levelInfo: {
      flex: 1,
      minWidth: 0,
    },
    levelTitle: {
      fontFamily: F.serif,
      fontSize: 26,
      color: mc.text,
      marginBottom: 6,
    },
    levelSub: {
      fontSize: fontSize,
      color: mc.text2,
      fontFamily: F.mono,
      marginBottom: 14,
    },

    // xp bar
    xpBarWrap: {
      marginBottom: 8,
    },
    xpBarTrack: {
      height: 6,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    xpBarFill: {
      height: 6,
      backgroundColor: accentColor,
      borderRadius: 3,
    },
    xpBarLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 5,
    },
    xpBarLbl: {
      fontSize: 10,
      color: mc.text3,
      fontFamily: F.mono,
      letterSpacing: 1,
    },

    // streak badge
    streakBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: mc.borderH,
      marginTop: 10,
    },
    streakTxt: {
      fontSize: Math.max(10, fontSize - 2),
      color: accentColor,
      fontFamily: F.mono,
      letterSpacing: 2,
    },

    // .stats-row
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      minWidth: 130,
      paddingVertical: 18,
      paddingHorizontal: 16,
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
    },
    statVal: {
      fontFamily: F.serif,   // Playfair Display for large score numbers
      fontSize: 24,
      color: accentColor,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 10,
      color: mc.text3,
      letterSpacing: 4,
      textTransform: 'uppercase',
      fontFamily: F.mono,
    },

    // .section-head
    sectionHead: {
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 7,
      textTransform: 'uppercase',
      fontFamily: F.mono,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
      marginBottom: 14,
    },

    // How to earn XP grid
    earnGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 28,
    },
    earnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
      minWidth: 220,
      flex: 1,
    },
    earnRowGold: {
      borderColor: 'rgba(201,168,76,0.3)',
    },
    earnRowFull: {
      // grid-column: 1/-1 — on RN we set flexBasis to 100%
      flexBasis: '100%',
      flex: 0,
    },
    earnIcon: {
      width: 36,
      height: 36,
      backgroundColor: mc.goldDim,
      borderWidth: 1,
      borderColor: mc.borderH,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    earnIconGold: {
      backgroundColor: 'rgba(201,168,76,0.12)',
      borderColor: 'rgba(201,168,76,0.4)',
    },
    earnText: {
      flex: 1,
      minWidth: 0,
    },
    earnLabel: {
      fontSize: fontSize,
      color: mc.text,
      fontFamily: F.mono,
      marginBottom: 2,
    },
    earnDesc: {
      fontSize: 10,
      color: mc.text3,
      fontFamily: F.mono,
      letterSpacing: 1,
    },
    earnXP: {
      marginLeft: 'auto',
      fontFamily: F.serif,
      fontSize: 18,
      color: accentColor,
      flexShrink: 0,
    },
    multiplierNum: {
      fontFamily: F.serif,
      fontSize: 24,
      color: accentColor,
    },

    // Milestones grid
    milestonesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 0,
    },
    milestone: {
      minWidth: 140,
      flex: 1,
      padding: 14,
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
    },
    milestoneReached: {
      borderColor: 'rgba(201,168,76,0.4)',
    },
    msLock: {
      fontSize: 18,
      color: accentColor,
      marginBottom: 4,
      fontFamily: F.mono,
    },
    msLevel: {
      fontSize: 10,
      color: mc.text3,
      fontFamily: F.mono,
      letterSpacing: 4,
      marginBottom: 4,
    },
    msTitle: {
      fontSize: fontSize,
      color: mc.text2,
      fontFamily: F.serif,
    },

    // Events list
    eventsList: {
      flexDirection: 'column',
      gap: 1,
      marginBottom: 28,
    },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 11,
      paddingHorizontal: 14,
      backgroundColor: mc.surface,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(201,168,76,0.06)',
    },
    eventDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: accentColor,
      flexShrink: 0,
    },
    eventType: {
      fontSize: fontSize,
      color: mc.text2,
      fontFamily: F.mono,
      flex: 1,
    },
    eventXP: {
      fontSize: fontSize,
      color: accentColor,
      fontFamily: F.serif,
      letterSpacing: 1,
      flexShrink: 0,
    },
    eventDate: {
      fontSize: 10,
      color: mc.text3,
      fontFamily: F.mono,
      marginLeft: 8,
      flexShrink: 0,
    },
    emptyBox: {
      paddingVertical: 20,
      paddingHorizontal: 14,
    },
    emptyTxt: {
      fontSize: fontSize,
      color: mc.text3,
      fontFamily: F.mono,
    },

    // Leaderboard
    lbWrap: {
      flexDirection: 'column',
      gap: 2,
    },
    lbGap: {
      height: 10,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    lbGapDots: {
      color: mc.text3,
      fontFamily: F.mono,
      fontSize: 11,
      letterSpacing: 4,
    },
    lbRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 13,
      paddingHorizontal: 16,
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
    },
    lbRank: {
      fontFamily: F.serif,
      fontSize: 22,
      color: mc.text3,
      width: 36,
      textAlign: 'center',
      flexShrink: 0,
      lineHeight: 26,
    },
    lbMedalSlot: {
      width: 24,
      alignItems: 'center',
      flexShrink: 0,
    },
    lbName: {
      fontSize: fontSize,
      color: mc.text,
      flex: 1,
      fontFamily: F.mono,
      letterSpacing: 1,
    },
    lbLevel: {
      fontSize: Math.max(10, fontSize - 2),
      color: mc.text3,
      fontFamily: F.mono,
      letterSpacing: 1,
      flexShrink: 0,
    },
    lbXP: {
      fontFamily: F.serif,
      fontSize: 15,
      color: accentColor,
      marginLeft: 10,
      flexShrink: 0,
    },
    lbYou: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: 'rgba(201,168,76,0.4)',
      marginLeft: 8,
      flexShrink: 0,
    },
    lbYouTxt: {
      fontSize: 9,
      color: accentColor,
      fontFamily: F.mono,
      letterSpacing: 5,
    },
    lbSummary: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
      borderTopWidth: 0,
    },
    lbSummaryTxt: {
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      color: mc.text3,
      letterSpacing: 1,
    },
  });

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.container}>

      {/* h1 + subtitle */}
      <Text style={st.h1}>Your Score</Text>
      <Text style={st.subtitle}>Progress &amp; Achievements</Text>

      {loading && (
        <ActivityIndicator color={accentColor} style={{ marginTop: 40 }} />
      )}

      {!loading && !score && (
        <View style={{ alignItems: 'center', paddingTop: 60, gap: 16 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text3, textAlign: 'center' }}>
            Could not load your score.{'\n'}Check your connection and try again.
          </Text>
          <TouchableOpacity
            onPress={loadData}
            style={{ borderWidth: 1, borderColor: accentColor, paddingHorizontal: 20, paddingVertical: 10 }}
          >
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: accentColor, letterSpacing: 2 }}>RETRY</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && score && (
        <>
          {/* ── Level Hero ── */}
          <View style={st.levelHero}>

            {/* Ring — SVG rotated -90deg so arc starts at top */}
            <View style={st.ringWrap}>
              <View style={{ transform: [{ rotate: '-90deg' }] }}>
                <Svg width={110} height={110} viewBox="0 0 110 110">
                  {/* track */}
                  <Circle
                    cx={55} cy={55} r={RING_R}
                    fill="none"
                    stroke="rgba(201,168,76,0.1)"
                    strokeWidth={7}
                  />
                  {/* progress arc */}
                  <Circle
                    cx={55} cy={55} r={RING_R}
                    fill="none"
                    stroke={accentColor}
                    strokeWidth={7}
                    strokeLinecap="round"
                    strokeDasharray={`${RING_CIRC}`}
                    strokeDashoffset={`${dashOffset}`}
                  />
                </Svg>
              </View>
              {/* center label */}
              <View style={st.ringCenter}>
                <Text style={st.ringLabel}>LEVEL</Text>
                <Text style={st.ringNum}>{score ? level : '—'}</Text>
              </View>
            </View>

            {/* Level info */}
            <View style={st.levelInfo}>
              <Text style={st.levelTitle}>{score ? levelTitle(level) : '—'}</Text>
              <Text style={st.levelSub}>
                {score
                  ? (level >= maxLevel
                      ? 'Maximum level achieved — legendary!'
                      : `${xpInLevel} XP into Level ${level}`)
                  : ''}
              </Text>

              {/* XP bar */}
              <View style={st.xpBarWrap}>
                <View style={st.xpBarTrack}>
                  <View style={[st.xpBarFill, { width: `${(xpPct * 100).toFixed(1)}%` }]} />
                </View>
                <View style={st.xpBarLabels}>
                  <Text style={st.xpBarLbl}>{xpInLevel} / {xpPerLevel} XP</Text>
                  <Text style={st.xpBarLbl}>
                    {level < maxLevel
                      ? `${xpPerLevel - xpInLevel} XP to Level ${level + 1}`
                      : 'Max level!'}
                  </Text>
                </View>
              </View>

              {/* Streak badge */}
              {(score?.streak ?? 0) > 0 && (
                <View style={st.streakBadge}>
                  <IconFire color={accentColor} />
                  <Text style={st.streakTxt}>{score.streak} day streak</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Stats row ── */}
          <View style={st.statsRow}>
            <View style={st.statCard}>
              <Text style={st.statVal}>
                {score ? Math.round(score.total_xp ?? 0).toLocaleString() : '—'}
              </Text>
              <Text style={st.statLabel}>Total XP</Text>
            </View>
            <View style={st.statCard}>
              <Text style={st.statVal}>{score ? (score.streak ?? 0) : '—'}</Text>
              <Text style={st.statLabel}>Day Streak</Text>
            </View>
            <View style={st.statCard}>
              <Text style={st.statVal}>{score ? maxLevel - level : '—'}</Text>
              <Text style={st.statLabel}>Levels to Max</Text>
            </View>
            <View style={st.statCard}>
              <Text style={st.statVal}>{score ? (score.events?.length ?? 0) : '—'}</Text>
              <Text style={st.statLabel}>XP Events</Text>
            </View>
          </View>

          {/* ── How to Earn XP ── */}
          <Text style={st.sectionHead}>How to Earn XP</Text>
          <View style={st.earnGrid}>

            {/* Daily check-in */}
            <View style={st.earnRow}>
              <View style={st.earnIcon}><IconHome color={accentColor} /></View>
              <View style={st.earnText}>
                <Text style={st.earnLabel}>Daily check-in</Text>
                <Text style={st.earnDesc}>Visit any page · once per day</Text>
              </View>
              <Text style={st.earnXP}>+5 XP</Text>
            </View>

            {/* Log food */}
            <View style={st.earnRow}>
              <View style={st.earnIcon}><IconEdit color={accentColor} /></View>
              <View style={st.earnText}>
                <Text style={st.earnLabel}>Log food</Text>
                <Text style={st.earnDesc}>Add a meal in Log Today · once per day</Text>
              </View>
              <Text style={st.earnXP}>+8 XP</Text>
            </View>

            {/* Log exercise */}
            <View style={st.earnRow}>
              <View style={st.earnIcon}><IconActivity color={accentColor} /></View>
              <View style={st.earnText}>
                <Text style={st.earnLabel}>Log exercise</Text>
                <Text style={st.earnDesc}>Fill workout field in Log Today · once per day</Text>
              </View>
              <Text style={st.earnXP}>+8 XP</Text>
            </View>

            {/* Hit calorie goal */}
            <View style={st.earnRow}>
              <View style={st.earnIcon}><IconCheck color={accentColor} /></View>
              <View style={st.earnText}>
                <Text style={st.earnLabel}>Hit calorie goal</Text>
                <Text style={st.earnDesc}>Within 200 kcal of your target · once per day</Text>
              </View>
              <Text style={st.earnXP}>+12 XP</Text>
            </View>

            {/* Blood report */}
            <View style={st.earnRow}>
              <View style={st.earnIcon}><IconBlood color={accentColor} /></View>
              <View style={st.earnText}>
                <Text style={st.earnLabel}>Blood report</Text>
                <Text style={st.earnDesc}>Analyze in Blood Monitor · once per month</Text>
              </View>
              <Text style={st.earnXP}>+100 XP</Text>
            </View>

            {/* Streak bonuses — gold border variant */}
            <View style={[st.earnRow, st.earnRowGold]}>
              <View style={[st.earnIcon, st.earnIconGold]}><IconFire color={accentColor} /></View>
              <View style={st.earnText}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={[st.earnLabel, { color: accentColor }]}>Streak bonuses</Text>
                  <Text style={[st.earnDesc, { opacity: 0.7 }]}>(added on daily check-in)</Text>
                </View>
                <Text style={[st.earnDesc, { lineHeight: 19 }]}>
                  {'7-day streak: '}
                  <Text style={{ color: accentColor }}>+5 XP</Text>
                  {'\n30-day streak: '}
                  <Text style={{ color: accentColor }}>+50 XP</Text>
                  {'\n100-day streak: '}
                  <Text style={{ color: accentColor }}>+70 XP</Text>
                </Text>
              </View>
            </View>

            {/* Level multipliers — full-width gold border */}
            <View style={[st.earnRow, st.earnRowGold, st.earnRowFull]}>
              <View style={[st.earnIcon, st.earnIconGold]}><IconStar color={accentColor} /></View>
              <View style={[st.earnText, { flex: 1 }]}>
                <Text style={[st.earnLabel, { color: accentColor, marginBottom: 4 }]}>
                  Level multipliers — all XP earned is multiplied by your tier
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 4 }}>
                  <Text style={st.earnDesc}>
                    {'Level 1-99: '}
                    <Text style={{ color: mc.text2 }}>1x (base)</Text>
                  </Text>
                  <Text style={st.earnDesc}>
                    {'Level 100-199: '}
                    <Text style={{ color: accentColor }}>5x all XP</Text>
                  </Text>
                  <Text style={st.earnDesc}>
                    {'Level 200-300: '}
                    <Text style={{ color: accentColor }}>20x all XP</Text>
                  </Text>
                </View>
                <Text style={st.earnDesc}>
                  Example at Level 200+: daily check-in = 100 XP · food log = 160 XP · blood report = 2,000 XP
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                <Text style={[st.earnDesc, { color: accentColor, marginBottom: 2 }]}>Your tier:</Text>
                <Text style={[st.multiplierNum]}>{multiplier}x</Text>
              </View>
            </View>

          </View>

          {/* ── Milestones ── */}
          <Text style={st.sectionHead}>Milestones</Text>
          <View style={st.milestonesGrid}>
            {MILESTONES.map((m, i) => {
              const reached = level >= m.level;
              return (
                <View key={i} style={[st.milestone, reached && st.milestoneReached]}>
                  <Text style={[st.msLock, { opacity: reached ? 1 : 0.18 }]}>
                    {reached ? 'x' : 'o'}
                  </Text>
                  <Text style={st.msLevel}>Level {m.level}</Text>
                  <Text style={[st.msTitle, reached && { color: accentColor }]}>{m.title}</Text>
                </View>
              );
            })}
          </View>

          {/* ── Recent XP Activity ── */}
          <Text style={[st.sectionHead, { marginTop: 28 }]}>Recent XP Activity</Text>
          <View style={st.eventsList}>
            {(score?.events?.length ?? 0) === 0 ? (
              <View style={st.emptyBox}>
                <Text style={st.emptyTxt}>
                  No XP events yet. Log food, exercise, or analyze a blood report to earn XP.
                </Text>
              </View>
            ) : (
              score.events.map((ev, i) => {
                const dt    = ev.awarded_at ? ev.awarded_at.split('T')[0] : '';
                const lbl   = ACTION_LABELS[ev.event_type] || ev.event_type || '';
                const note  = ev.note ? ` · ${ev.note}` : '';
                return (
                  <View key={i} style={st.eventRow}>
                    <View style={st.eventDot} />
                    <Text style={st.eventType}>{lbl}{note}</Text>
                    <Text style={st.eventXP}>+{ev.xp_awarded} XP</Text>
                    <Text style={st.eventDate}>{dt}</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* ── World Rankings ── */}
          <Text style={[st.sectionHead, { marginTop: 32 }]}>World Rankings</Text>
          <View style={{ marginBottom: 28 }}>
            {board.length === 0 ? (
              <View style={st.emptyBox}>
                <Text style={st.emptyTxt}>Loading rankings...</Text>
              </View>
            ) : (
              <>
                <View style={st.lbWrap}>
                  {board.map((e, i) => {
                    const r     = e.rank;
                    const isMe  = !!e.is_me;
                    const isGap = e.gap && r > (board[i - 1]?.rank ?? 0) + 1;
                    return (
                      <React.Fragment key={i}>
                        {isGap && (
                          <View style={st.lbGap}>
                            <Text style={st.lbGapDots}>···</Text>
                          </View>
                        )}
                        <View style={[
                          st.lbRow,
                          r === 1 && { borderColor: 'rgba(201,168,76,0.6)', backgroundColor: 'rgba(201,168,76,0.07)' },
                          r === 2 && { borderColor: 'rgba(168,169,173,0.4)' },
                          r === 3 && { borderColor: 'rgba(205,127,50,0.4)' },
                          isMe   && { borderColor: 'rgba(201,168,76,0.45)', backgroundColor: 'rgba(201,168,76,0.04)' },
                        ]}>
                          <Text style={[
                            st.lbRank,
                            r === 1 && { color: accentColor },
                            r === 2 && { color: '#A8A9AD' },
                            r === 3 && { color: '#CD7F32' },
                          ]}>
                            {r}
                          </Text>
                          {/* medal placeholder — text space kept for layout alignment */}
                          <View style={st.lbMedalSlot}>
                            {r === 1 && (
                              <Svg width={16} height={16} viewBox="0 0 24 24" fill={accentColor} stroke="none">
                                <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </Svg>
                            )}
                            {r === 2 && (
                              <Svg width={16} height={16} viewBox="0 0 24 24" fill="#A8A9AD" stroke="none">
                                <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </Svg>
                            )}
                            {r === 3 && (
                              <Svg width={16} height={16} viewBox="0 0 24 24" fill="#CD7F32" stroke="none">
                                <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </Svg>
                            )}
                          </View>
                          <Text
                            style={[st.lbName, isMe && { color: accentColor }]}
                            numberOfLines={1}
                          >
                            {e.name ?? e.display_name ?? e.username ?? ''}
                          </Text>
                          <Text style={st.lbLevel}>
                            Lv {Number(e.level ?? 0).toLocaleString()}
                          </Text>
                          <Text style={st.lbXP}>
                            {Number(e.xp ?? e.total_xp ?? 0).toLocaleString()} XP
                          </Text>
                          {isMe && (
                            <View style={st.lbYou}>
                              <Text style={st.lbYouTxt}>YOU</Text>
                            </View>
                          )}
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>

                {/* lb-summary */}
                {lb?.my_rank != null && (
                  <View style={st.lbSummary}>
                    {lb.my_rank === 1 ? (
                      <Text style={st.lbSummaryTxt}>
                        You are ranked{' '}
                        <Text style={{ color: accentColor }}>#1 in the world</Text>
                        !
                      </Text>
                    ) : (
                      <Text style={st.lbSummaryTxt}>
                        {'Your global rank: '}
                        <Text style={{ color: accentColor }}>
                          #{Number(lb.my_rank).toLocaleString()}
                        </Text>
                        {' out of '}
                        {Number(lb.total_users ?? 0).toLocaleString()}
                        {' users'}
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
