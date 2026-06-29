import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { getChallenges, getChallengeLb } from '../api';
import { getToken, getUser } from '../auth';

const METRIC_UNIT = {
  workouts:   'workouts',
  xp:         'XP',
  checkins:   'check-ins',
  food_logs:  'food logs',
};

export default function ChallengesScreen({ navigation }) {
  const { mc, accentColor } = useTheme();
  const [challenges, setChallenges] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal,      setModal]      = useState(null);   // { title, unit, board, loading }

  useEffect(() => { loadChallenges(); }, []);

  async function loadChallenges() {
    setLoading(true);
    const d = await getChallenges();
    if (d?.ok) setChallenges(d.challenges || []);
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadChallenges();
    setRefreshing(false);
  }

  async function openLb(ch) {
    const unit = METRIC_UNIT[ch.metric] || ch.metric;
    setModal({ title: ch.title, unit, board: null, loading: true });
    const d = await getChallengeLb(ch.id);
    if (d?.ok) {
      setModal({
        title:   ch.title,
        unit,
        board:   d.board.filter(b => b.progress > 0),
        loading: false,
      });
    } else {
      setModal(prev => prev ? { ...prev, loading: false } : null);
    }
  }

  function closeLb() { setModal(null); }

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const st = StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: mc.bg,
    },

    /* Header */
    header: {
      paddingHorizontal: 56,
      paddingTop: 44,
      paddingBottom: 36,
    },
    pageLabel: {
      fontSize: 10,
      color: mc.text3,
      letterSpacing: 3.36,      // ~.24em at 14px base
      textTransform: 'uppercase',
      fontFamily: F.mono,
      marginBottom: 6,
    },
    pageTitle: {
      fontFamily: F.serif,
      fontSize: 32,
      color: mc.text,
      marginBottom: 4,
    },
    pageSub: {
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 0.7,
      fontFamily: F.mono,
    },

    /* Grid */
    grid: {
      paddingHorizontal: 56,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },

    /* Loading / empty */
    loadingWrap: {
      paddingHorizontal: 56,
      paddingTop: 8,
    },
    loadingText: {
      fontSize: 12,
      color: mc.text3,
      fontFamily: F.mono,
    },

    /* Challenge card */
    chCard: {
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
      padding: 28,
      minWidth: 320,
      flex: 1,
      position: 'relative',
    },
    chCardCompleted: {
      borderColor: 'rgba(76,175,130,0.4)',
    },

    /* Completed badge */
    doneBadge: {
      position: 'absolute',
      top: 14,
      right: 14,
      borderWidth: 1,
      borderColor: 'rgba(76,175,130,0.4)',
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    doneBadgeTxt: {
      fontSize: 10,
      color: C.green,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      fontFamily: F.mono,
    },

    chTitle: {
      fontFamily: F.serif,
      fontSize: 20,
      color: mc.text,
      marginBottom: 6,
    },
    chDesc: {
      fontSize: 11,
      color: mc.text3,
      lineHeight: 18.7,          // 1.7 line-height
      fontFamily: F.mono,
      marginBottom: 20,
    },

    /* Progress */
    progRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 6,
    },
    progVal: {
      fontFamily: F.serif,
      fontSize: 18,
      color: accentColor,
    },
    progTarget: {
      fontSize: 11,
      color: mc.text3,
      fontFamily: F.mono,
    },
    progBar: {
      height: 4,
      backgroundColor: mc.border,
      position: 'relative',
      marginBottom: 20,
    },
    progFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      backgroundColor: accentColor,
    },
    progFillDone: {
      backgroundColor: C.green,
    },

    /* Mini leaderboard */
    lbHead: {
      fontSize: 10,
      color: mc.text3,
      letterSpacing: 2.24,       // ~.16em
      textTransform: 'uppercase',
      fontFamily: F.mono,
      marginBottom: 8,
    },
    lbRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    lbRowLast: {
      borderBottomWidth: 0,
    },
    lbRank: {
      fontSize: 11,
      color: mc.text3,
      width: 18,
      textAlign: 'center',
      fontFamily: F.mono,
    },
    lbName: {
      flex: 1,
      fontSize: 12,
      color: mc.text,
      fontFamily: F.mono,
    },
    lbNameMe: {
      color: accentColor,
    },
    lbProg: {
      fontSize: 12,
      color: mc.text2,
      fontFamily: F.mono,
    },
    noEntries: {
      fontSize: 11,
      color: mc.text3,
      fontFamily: F.mono,
    },
    lbMore: {
      fontSize: 11,
      color: mc.text3,
      textAlign: 'right',
      marginTop: 8,
      letterSpacing: 0.84,       // ~.06em
      fontFamily: F.mono,
    },

    /* Full leaderboard modal */
    modalBd: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modal: {
      backgroundColor: mc.elevated,
      borderWidth: 1,
      borderColor: mc.borderH,
      minWidth: 380,
      maxWidth: 520,
      maxHeight: '80%',
    },
    modalContent: {
      padding: 32,
    },
    modalClose: {
      position: 'absolute',
      top: 14,
      right: 18,
    },
    modalCloseTxt: {
      fontSize: 18,
      color: mc.text3,
      fontFamily: F.mono,
    },
    modalTitle: {
      fontFamily: F.serif,
      fontSize: 20,
      color: mc.text,
      marginBottom: 4,
      paddingRight: 28,          // avoid overlap with close button
    },
    modalSub: {
      fontSize: 11,
      color: mc.text3,
      fontFamily: F.mono,
      marginBottom: 20,
    },

    /* Full leaderboard rows */
    fullLbRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    fullLbRowLast: {
      borderBottomWidth: 0,
    },
    fullLbRank: {
      fontFamily: F.serif,
      fontSize: 16,
      color: mc.text3,
      width: 24,
    },
    fullLbName: {
      flex: 1,
      fontSize: 13,
      color: mc.text,
      fontFamily: F.mono,
    },
    fullLbNameMe: {
      color: accentColor,
      fontWeight: '700',
    },
    fullLbBar: {
      width: 80,
      height: 3,
      backgroundColor: mc.border,
      position: 'relative',
      flexShrink: 0,
    },
    fullLbBarFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      backgroundColor: accentColor,
    },
    fullLbVal: {
      fontSize: 12,
      color: mc.text2,
      fontFamily: F.mono,
      width: 48,
      textAlign: 'right',
    },
  });

  return (
    <>
      <ScrollView
        style={st.screen}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />
        }
      >
        {/* Page header */}
        <View style={st.header}>
          <Text style={st.pageLabel}>This Month</Text>
          <Text style={st.pageTitle}>Challenges</Text>
          <Text style={st.pageSub}>
            Compete with everyone — top performers earn glory. Rankings reset each month.
          </Text>
        </View>

        {/* Challenge grid */}
        {loading ? (
          <View style={st.loadingWrap}>
            <Text style={st.loadingText}>Loading...</Text>
          </View>
        ) : challenges.length === 0 ? (
          <View style={st.loadingWrap}>
            <Text style={st.loadingText}>No active challenges.</Text>
          </View>
        ) : (
          <View style={st.grid}>
            {challenges.map(ch => {
              const unit = METRIC_UNIT[ch.metric] || ch.metric;
              const pct  = Math.min(100, Math.max(0, ch.pct || 0));
              const done = !!ch.completed;

              return (
                <View
                  key={ch.id}
                  style={[st.chCard, done && st.chCardCompleted]}
                >
                  {/* Completed badge */}
                  {done && (
                    <View style={st.doneBadge}>
                      <Text style={st.doneBadgeTxt}>Completed</Text>
                    </View>
                  )}

                  {/* Title */}
                  <Text style={st.chTitle}>{ch.title}</Text>

                  {/* Description */}
                  <Text style={st.chDesc}>{ch.description}</Text>

                  {/* Progress row */}
                  <View style={st.progRow}>
                    <Text style={st.progVal}>
                      {(ch.my_progress || 0).toLocaleString()}
                    </Text>
                    <Text style={st.progTarget}>
                      / {(ch.target || 0).toLocaleString()} {unit}
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={st.progBar}>
                    <View
                      style={[
                        st.progFill,
                        { width: `${pct}%` },
                        done && st.progFillDone,
                      ]}
                    />
                  </View>

                  {/* Mini leaderboard */}
                  <Text style={st.lbHead}>Leaderboard</Text>

                  {ch.top5 && ch.top5.length > 0 ? (
                    ch.top5.map((b, idx) => (
                      <View
                        key={b.username + idx}
                        style={[st.lbRow, idx === (ch.top5.length - 1) && st.lbRowLast]}
                      >
                        <Text style={st.lbRank}>
                          {b.rank <= 3
                            ? ['1', '2', '3'][b.rank - 1]
                            : b.rank}
                        </Text>
                        <Text style={[st.lbName, b.is_me && st.lbNameMe]}>
                          @{b.username}
                        </Text>
                        <Text style={st.lbProg}>
                          {(b.progress || 0).toLocaleString()} {unit}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={st.noEntries}>No entries yet — be first!</Text>
                  )}

                  {/* View full leaderboard */}
                  <TouchableOpacity onPress={() => openLb(ch)} activeOpacity={0.7}>
                    <Text style={st.lbMore}>View full leaderboard ›</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full leaderboard modal */}
      <Modal
        visible={!!modal}
        transparent
        animationType="fade"
        onRequestClose={closeLb}
      >
        <TouchableOpacity
          style={st.modalBd}
          activeOpacity={1}
          onPress={closeLb}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <ScrollView style={st.modal} contentContainerStyle={st.modalContent}>
              {/* Close button */}
              <TouchableOpacity style={st.modalClose} onPress={closeLb}>
                <Text style={st.modalCloseTxt}>x</Text>
              </TouchableOpacity>

              {/* Modal title */}
              <Text style={st.modalTitle}>{modal?.title}</Text>
              <Text style={st.modalSub}>All participants</Text>

              {/* Modal body */}
              {modal?.loading ? (
                <Text style={st.loadingText}>Loading...</Text>
              ) : modal?.board && modal.board.length > 0 ? (
                modal.board.map((b, idx) => (
                  <View
                    key={b.username + idx}
                    style={[
                      st.fullLbRow,
                      idx === (modal.board.length - 1) && st.fullLbRowLast,
                    ]}
                  >
                    <Text style={st.fullLbRank}>
                      {b.rank <= 3 ? ['1', '2', '3'][b.rank - 1] : b.rank}
                    </Text>
                    <Text style={[st.fullLbName, b.is_me && st.fullLbNameMe]}>
                      {b.name || '@' + b.username}{b.is_me ? ' (you)' : ''}
                    </Text>
                    <View style={st.fullLbBar}>
                      <View
                        style={[
                          st.fullLbBarFill,
                          { width: `${Math.min(100, b.pct || 0)}%` },
                        ]}
                      />
                    </View>
                    <Text style={st.fullLbVal}>
                      {(b.progress || 0).toLocaleString()}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={st.loadingText}>No entries yet.</Text>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

