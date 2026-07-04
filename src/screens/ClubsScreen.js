import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { getClubs, createClub, joinClub, leaveClub, getClubDetail, getClubFeed } from '../api';
import { getToken, getUser } from '../auth';
import { StatBar } from '../components/Charts';

const LBLS = {
  login:        'checked in',
  food_log:     'logged meals',
  calorie_goal: 'hit calorie goal',
  exercise:     'completed a workout',
  blood_report: 'analyzed blood report',
};

export default function ClubsScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  const [tab,          setTab]          = useState('mine');
  const [myClubs,      setMyClubs]      = useState([]);
  const [discover,     setDiscover]     = useState([]);
  const [listLoading,  setListLoading]  = useState(true);
  const [activeId,     setActiveId]     = useState(null);

  // Detail pane
  const [detail,       setDetail]       = useState(null);   // { club, members, is_member }
  const [feed,         setFeed]         = useState([]);
  const [detailLoad,   setDetailLoad]   = useState(false);

  // Create modal
  const [showCreate,   setShowCreate]   = useState(false);
  const [cName,        setCName]        = useState('');
  const [cDesc,        setCDesc]        = useState('');
  const [creating,     setCreating]     = useState(false);

  useEffect(() => { loadList(); }, []);

  async function loadList() {
    setListLoading(true);
    const d = await getClubs();
    if (d?.ok) {
      setMyClubs(d.my_clubs || []);
      setDiscover(d.discover || []);
    }
    setListLoading(false);
  }

  async function selectClub(id) {
    setActiveId(id);
    setDetail(null);
    setFeed([]);
    setDetailLoad(true);
    const [det, fd] = await Promise.all([getClubDetail(id), getClubFeed(id)]);
    setDetailLoad(false);
    if (det?.ok) {
      setDetail(det);
      setFeed(fd?.ok ? (fd.feed || []) : []);
    }
  }

  async function handleJoin(id) {
    await joinClub(id);
    await loadList();
    await selectClub(id);
  }

  async function handleLeave(id) {
    await leaveClub(id);
    setDetail(null);
    setActiveId(null);
    await loadList();
  }

  async function handleCreate() {
    if (!cName.trim()) return;
    setCreating(true);
    const d = await createClub({ name: cName.trim(), description: cDesc.trim() });
    setCreating(false);
    if (d?.ok) {
      setShowCreate(false);
      setCName('');
      setCDesc('');
      await loadList();
      selectClub(d.club_id);
    }
  }

  const clubs = tab === 'mine' ? myClubs : discover;

  // ─── Render left panel club item ────────────────────────────────────────────
  function ClubItem({ c }) {
    const isActive = c.id === activeId;
    return (
      <TouchableOpacity
        style={[st.clubItem, isActive && st.clubItemActive]}
        onPress={() => selectClub(c.id)}
        activeOpacity={0.75}
      >
        <Text style={st.clubItemName}>{c.name}</Text>
        <Text style={st.clubItemMeta}>
          {c.member_count} member{c.member_count !== 1 ? 's' : ''}
        </Text>
        {tab === 'discover' && (
          <TouchableOpacity
            style={st.clubItemJoin}
            onPress={() => handleJoin(c.id)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={st.clubItemJoinTxt}>+ Join</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  // ─── Render feed card ────────────────────────────────────────────────────────
  function FeedCard({ e }) {
    const initial = (e.name || e.username || '?')[0].toUpperCase();
    return (
      <View style={st.feedCard}>
        <View style={st.feedTop}>
          <View style={st.feedAv}>
            <Text style={st.feedAvTxt}>{initial}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={st.feedWho} numberOfLines={1}>
              <Text style={st.feedWhoName}>{e.name || ('@' + e.username)}</Text>
              {'  '}{LBLS[e.event_type] || e.event_type}
            </Text>
          </View>
          <Text style={st.feedXp}>+{e.xp} XP</Text>
          <Text style={st.feedTime}>{(e.at || '').slice(0, 10)}</Text>
        </View>
      </View>
    );
  }

  // ─── Render member leaderboard row ───────────────────────────────────────────
  function MbRow({ m }) {
    const rankLabel = m.rank <= 3
      ? ['1', '2', '3'][m.rank - 1]
      : String(m.rank);
    return (
      <View style={[st.mbRow, m.is_me && { backgroundColor: mc.goldDim }]}>
        <Text style={[st.mbRank, m.rank <= 3 && { color: accentColor }]}>{rankLabel}</Text>
        <Text style={[st.mbName, m.is_me && { color: accentColor }]} numberOfLines={1}>
          @{m.username}{m.role === 'admin' ? ' [admin]' : ''}
        </Text>
        <Text style={st.mbXp}>{(m.month_xp || 0).toLocaleString()} XP this month</Text>
      </View>
    );
  }

  // ─── Render member activity leaderboard (relative bars) ──────────────────────
  function MemberActivityChart({ members }) {
    const topXp = Math.max(...members.map(m => m.month_xp || 0), 1);
    return (
      <View style={{ marginTop: 4 }}>
        {members.map(m => (
          <StatBar
            key={m.username}
            label={`@${m.username}${m.is_me ? ' (you)' : ''}`}
            value={m.month_xp || 0}
            max={topXp}
            color={m.is_me ? accentColor : mc.text3}
            mc={mc}
            displayValue={`${(m.month_xp || 0).toLocaleString()} XP`}
          />
        ))}
      </View>
    );
  }

  // ─── Main detail pane ────────────────────────────────────────────────────────
  function DetailPane() {
    if (!activeId && !detailLoad) {
      return (
        <View style={st.emptyState}>
          <Text style={st.emptyTxt}>Select a club to view its feed and members.</Text>
          <Text style={st.emptyTxt}>Or create one and invite your buddies.</Text>
        </View>
      );
    }
    if (detailLoad) {
      return (
        <View style={st.emptyState}>
          <ActivityIndicator color={accentColor} />
          <Text style={[st.emptyTxt, { marginTop: 12 }]}>Loading...</Text>
        </View>
      );
    }
    if (!detail) {
      return (
        <View style={st.emptyState}>
          <Text style={st.emptyTxt}>Club not found.</Text>
        </View>
      );
    }

    const c       = detail.club;
    const members = detail.members || [];
    const isMem   = detail.is_member;
    const initial = (c.name || '?')[0].toUpperCase();

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Club hero */}
        <View style={st.clubHero}>
          <View style={st.heroAv}>
            <Text style={st.heroAvTxt}>{initial}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={st.heroName}>{c.name}</Text>
            <Text style={st.heroDesc} numberOfLines={3}>
              {c.description || 'No description.'}
            </Text>
          </View>
          <View style={st.heroActions}>
            {isMem ? (
              <TouchableOpacity style={st.btnLeave} onPress={() => handleLeave(c.id)}>
                <Text style={st.btnLeaveTxt}>Leave</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={st.btnJoin} onPress={() => handleJoin(c.id)}>
                <Text style={st.btnJoinTxt}>+ Join</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Two-column layout: feed + leaderboard */}
        <View style={st.detailCols}>
          {/* Activity Feed */}
          <View style={{ flex: 1 }}>
            <Text style={S.sectionHead}>Activity Feed</Text>
            {feed.length > 0
              ? feed.map((e, i) => <FeedCard key={e.id || i} e={e} />)
              : (
                <View style={st.feedCard}>
                  <Text style={st.noDataTxt}>No activity yet from club members.</Text>
                </View>
              )
            }
          </View>

          {/* Monthly Leaderboard */}
          <View style={st.leaderCol}>
            <View style={st.panelBox}>
              <Text style={S.sectionHead}>Monthly Leaderboard</Text>
              {members.length > 0
                ? members.map(m => <MbRow key={m.username} m={m} />)
                : <Text style={st.noDataTxt}>No members yet.</Text>
              }
            </View>
            {members.length > 0 && (
              <View style={[st.panelBox, { marginTop: 16 }]}>
                <Text style={S.sectionHead}>Activity vs. Top Member</Text>
                <MemberActivityChart members={members} />
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    );
  }

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const st = StyleSheet.create({

    // Layout
    leftPanel: {
      width: 280,
      borderRightWidth: 1,
      borderRightColor: mc.border,
      backgroundColor: mc.bg,
      flexDirection: 'column',
    },
    main: {
      flex: 1,
      backgroundColor: mc.bg,
    },

    // Left panel header
    lpHead: {
      padding: 20,
      paddingTop: 24,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    lpTitle: {
      fontFamily: F.serif,
      fontSize: 20,
      color: mc.text,
      marginBottom: 12,
    },
    btnCreate: {
      width: '100%',
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: 'rgba(201,168,76,0.45)',
      alignItems: 'center',
    },
    btnCreateTxt: {
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: accentColor,
    },

    // Tabs
    tabRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: accentColor,
    },
    tabTxt: {
      fontSize: Math.max(10, fontSize - 2),
      fontFamily: F.mono,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: mc.text3,
    },

    // Club list items
    listMeta: {
      padding: 16,
      fontSize: 11,
      color: mc.text3,
      fontFamily: F.mono,
    },
    clubItem: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    clubItemActive: {
      backgroundColor: mc.goldDim,
    },
    clubItemName: {
      fontSize: fontSize,
      color: mc.text,
      fontFamily: F.mono,
      marginBottom: 3,
    },
    clubItemMeta: {
      fontSize: 10,
      color: mc.text3,
      fontFamily: F.mono,
      letterSpacing: 1,
    },
    clubItemJoin: {
      marginTop: 4,
    },
    clubItemJoinTxt: {
      fontSize: 10,
      color: accentColor,
      fontFamily: F.mono,
      letterSpacing: 2,
    },

    // Empty state
    emptyState: {
      flex: 1,
      paddingVertical: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTxt: {
      color: mc.text3,
      fontFamily: F.mono,
      fontSize: fontSize,
      lineHeight: 26,
      textAlign: 'center',
      paddingHorizontal: 24,
    },

    // Club hero
    clubHero: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 28,
      paddingHorizontal: 32,
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
      marginBottom: 20,
    },
    heroAv: {
      width: 56,
      height: 56,
      backgroundColor: mc.goldDim,
      borderWidth: 1,
      borderColor: mc.borderH,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    heroAvTxt: {
      fontFamily: F.display,
      fontSize: 28,
      color: accentColor,
    },
    heroName: {
      fontFamily: F.serif,
      fontSize: 24,
      color: mc.text,
      marginBottom: 4,
    },
    heroDesc: {
      fontSize: Math.max(10, fontSize - 2),
      color: mc.text3,
      fontFamily: F.mono,
      lineHeight: 18,
    },
    heroActions: {
      marginLeft: 16,
      flexShrink: 0,
    },
    btnJoin: {
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: 'rgba(201,168,76,0.5)',
    },
    btnJoinTxt: {
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: accentColor,
    },
    btnLeave: {
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: mc.border,
    },
    btnLeaveTxt: {
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: mc.text3,
    },

    // Detail two-column layout
    detailCols: {
      flexDirection: 'row',
      gap: 16,
      alignItems: 'flex-start',
    },

    // Feed cards
    feedCard: {
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
      padding: 14,
      paddingHorizontal: 16,
      marginBottom: 2,
    },
    feedTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    feedAv: {
      width: 28,
      height: 28,
      backgroundColor: mc.goldDim,
      borderWidth: 1,
      borderColor: mc.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    feedAvTxt: {
      fontSize: fontSize,
      color: accentColor,
      fontFamily: F.mono,
      fontWeight: '700',
    },
    feedWho: {
      fontSize: fontSize,
      color: mc.text2,
      fontFamily: F.mono,
    },
    feedWhoName: {
      color: mc.text,
      fontFamily: F.mono,
      fontWeight: '700',
    },
    feedXp: {
      marginLeft: 'auto',
      fontFamily: F.serif,
      fontSize: fontSize,
      color: accentColor,
    },
    feedTime: {
      fontSize: 10,
      color: mc.text3,
      fontFamily: F.mono,
      marginLeft: 8,
    },
    noDataTxt: {
      fontSize: fontSize,
      color: mc.text3,
      fontFamily: F.mono,
      padding: 8,
    },

    // Leaderboard column
    leaderCol: {
      width: 280,
      flexShrink: 0,
    },
    panelBox: {
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
      padding: 20,
    },
    mbRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
      gap: 10,
    },
    mbRank: {
      fontSize: fontSize,
      color: mc.text3,
      fontFamily: F.mono,
      width: 20,
      textAlign: 'center',
      flexShrink: 0,
    },
    mbName: {
      flex: 1,
      fontSize: fontSize,
      color: mc.text,
      fontFamily: F.mono,
    },
    mbXp: {
      fontSize: Math.max(10, fontSize - 2),
      color: mc.text3,
      fontFamily: F.mono,
    },

    // Create modal
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
      padding: 32,
      minWidth: 360,
      maxWidth: 460,
      width: '90%',
    },
    modalTitle: {
      fontFamily: F.serif,
      fontSize: 20,
      color: mc.text,
      marginBottom: 20,
    },
    formInp: {
      width: '100%',
      backgroundColor: mc.bg,
      borderWidth: 1,
      borderColor: mc.border,
      color: mc.text,
      paddingVertical: 9,
      paddingHorizontal: 12,
      fontFamily: F.mono,
      fontSize: fontSize,
      marginBottom: 14,
      outlineWidth: 0,
    },
    formRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 6,
    },
    btnCancel: {
      paddingVertical: 9,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: mc.border,
    },
    btnCancelTxt: {
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      letterSpacing: 2,
      color: mc.text3,
    },
    btnSubmit: {
      paddingVertical: 9,
      paddingHorizontal: 18,
      backgroundColor: accentColor,
      alignItems: 'center',
      minWidth: 80,
    },
    btnSubmitTxt: {
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: '#0A0A0A',
      fontWeight: '700',
    },
  });

  // ─── Root ────────────────────────────────────────────────────────────────────
  return (
    <View style={S.screen}>

      {/* ── Left panel ── */}
      <View style={st.leftPanel}>

        {/* Header */}
        <View style={st.lpHead}>
          <Text style={st.lpTitle}>Clubs</Text>
          <TouchableOpacity style={st.btnCreate} onPress={() => setShowCreate(true)}>
            <Text style={st.btnCreateTxt}>+ CREATE CLUB</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={st.tabRow}>
          {[{ v: 'mine', l: 'My Clubs' }, { v: 'discover', l: 'Discover' }].map(t => (
            <TouchableOpacity
              key={t.v}
              style={[st.tab, tab === t.v && st.tabActive]}
              onPress={() => setTab(t.v)}
            >
              <Text style={[st.tabTxt, tab === t.v && { color: accentColor }]}>{t.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Club list */}
        <ScrollView style={{ flex: 1 }}>
          {listLoading ? (
            <Text style={st.listMeta}>Loading...</Text>
          ) : clubs.length === 0 ? (
            <Text style={st.listMeta}>
              {tab === 'mine' ? "You haven't joined any clubs yet." : 'No clubs to discover.'}
            </Text>
          ) : (
            clubs.map(c => <ClubItem key={c.id} c={c} />)
          )}
        </ScrollView>
      </View>

      {/* ── Main detail panel ── */}
      <View style={st.main}>
        <DetailPane />
      </View>

      {/* ── Create Club Modal ── */}
      <Modal
        visible={showCreate}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <TouchableOpacity
          style={st.modalBd}
          activeOpacity={1}
          onPress={() => setShowCreate(false)}
        >
          <TouchableOpacity
            style={st.modal}
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text style={st.modalTitle}>Create a Club</Text>

            <Text style={S.label}>Club Name</Text>
            <TextInput
              style={st.formInp}
              value={cName}
              onChangeText={setCName}
              placeholder="e.g. Morning Warriors"
              placeholderTextColor={mc.text3}
              maxLength={40}
            />

            <Text style={[S.label, { marginTop: 4 }]}>Description (optional)</Text>
            <TextInput
              style={st.formInp}
              value={cDesc}
              onChangeText={setCDesc}
              placeholder="What's this club about?"
              placeholderTextColor={mc.text3}
              maxLength={120}
            />

            <View style={st.formRow}>
              <TouchableOpacity style={st.btnCancel} onPress={() => setShowCreate(false)}>
                <Text style={st.btnCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.btnSubmit, creating && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator color="#0A0A0A" size="small" />
                  : <Text style={st.btnSubmitTxt}>Create</Text>
                }
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

