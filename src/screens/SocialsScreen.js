import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { getBuddies, searchUsers, sendBuddyReq, respondBuddy, removeBuddy, getActivity } from '../api';
import { getToken, getUser } from '../auth';
import { API_BASE } from '../config';

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(s) {
  if (!s) return '';
  const diff = (Date.now() - new Date(s.replace(' ', 'T') + 'Z')) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function initials(name) {
  return (name || '?')[0].toUpperCase();
}

// ─── Search SVG icon ────────────────────────────────────────────────────────

function SearchIcon({ mc }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"
      stroke={mc.text3} strokeWidth={2} strokeLinecap="round">
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </Svg>
  );
}

// ─── Avatar circle ──────────────────────────────────────────────────────────

function Avatar({ name, size = 34, st }) {
  return (
    <View style={[st.avatar, { width: size, height: size }]}>
      <Text style={[st.avatarTxt, { fontSize: size * 0.47 }]}>{initials(name)}</Text>
    </View>
  );
}

// ─── Reaction bar ───────────────────────────────────────────────────────────

const REACT_EMOJIS = ['AP', 'FIRE', 'STRONG', 'WIN', 'LOVE'];

function ReactBar({ feed, eventId, myReact, reactions, onReact, st, accentColor }) {
  return (
    <View style={st.reactRow}>
      {REACT_EMOJIS.map((label, i) => {
        const r = (reactions || []).find(x => x.emoji === label);
        const count = r ? r.count : 0;
        const active = myReact === label;
        return (
          <TouchableOpacity
            key={label}
            style={[st.reactBtn, active && st.reactBtnActive]}
            onPress={() => onReact(eventId, label)}
          >
            <Text style={[st.reactLabel, active && { color: accentColor }]}>{label}</Text>
            {count > 0 && <Text style={st.reactCount}>{count}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Feed card ──────────────────────────────────────────────────────────────

function FeedCard({ item, me, onReact, st, mc, accentColor }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText]   = useState('');
  const [comments, setComments]         = useState(item.comments || []);
  const [reactions, setReactions]       = useState(item.reactions || []);
  const [myReact, setMyReact]           = useState(item.my_react || null);

  async function handleReact(eventId, emoji) {
    // Optimistic toggle
    const wasActive = myReact === emoji;
    const newMyReact = wasActive ? null : emoji;
    setMyReact(newMyReact);
    setReactions(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(r => r.emoji === emoji);
      if (wasActive) {
        if (idx >= 0) updated[idx] = { ...updated[idx], count: Math.max(0, updated[idx].count - 1) };
      } else {
        // Remove old react if switching
        if (myReact) {
          const oi = updated.findIndex(r => r.emoji === myReact);
          if (oi >= 0) updated[oi] = { ...updated[oi], count: Math.max(0, updated[oi].count - 1) };
        }
        if (idx >= 0) updated[idx] = { ...updated[idx], count: updated[idx].count + 1 };
        else updated.push({ emoji, count: 1 });
      }
      return updated;
    });
    // Server call (fire-and-forget — we already updated optimistically)
    try {
      const token = await getToken();
      await fetch(API_BASE + '/perfect/api/activity/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ event_id: eventId, emoji }),
      });
    } catch (_) {}
  }

  async function submitComment() {
    const body = commentText.trim();
    if (!body) return;
    setCommentText('');
    setShowComments(false);
    setComments(prev => [...prev, { who: me || 'you', body }]);
    try {
      const token = await getToken();
      await fetch(API_BASE + '/perfect/api/activity/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ event_id: item.id, body }),
      });
    } catch (_) {}
  }

  return (
    <View style={st.feedCard}>
      {/* Main row */}
      <View style={st.feedItem}>
        <View style={st.fiIconWrap}>
          <Text style={st.fiIcon}>{item.icon || '+'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.fiLabel}>{item.label}</Text>
          {!!item.note && <Text style={st.fiNote}>{item.note}</Text>}
        </View>
        <Text style={st.fiXp}>+{item.xp} XP</Text>
        <Text style={st.fiTime}>{timeAgo(item.at)}</Text>
      </View>

      {/* Social bar */}
      <View style={st.socialBar}>
        <ReactBar
          eventId={item.id}
          myReact={myReact}
          reactions={reactions}
          onReact={handleReact}
          st={st}
          accentColor={accentColor}
        />
        <TouchableOpacity
          style={st.commentToggle}
          onPress={() => setShowComments(v => !v)}
        >
          <Text style={st.commentToggleTxt}>Comment</Text>
        </TouchableOpacity>
      </View>

      {/* Existing comments */}
      {comments.length > 0 && (
        <View style={st.commentsWrap}>
          {comments.map((c, i) => (
            <Text key={i} style={st.commentItem}>
              <Text style={st.commentWho}>{c.who}  </Text>
              {c.body}
            </Text>
          ))}
        </View>
      )}

      {/* Comment input */}
      {showComments && (
        <View style={st.commentForm}>
          <TextInput
            style={st.commentInp}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Write a comment..."
            placeholderTextColor={mc.text3}
            maxLength={200}
            onSubmitEditing={submitComment}
            returnKeyType="send"
          />
          <TouchableOpacity style={st.commentSend} onPress={submitComment}>
            <Text style={st.commentSendTxt}>Send</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Buddy activity view (right-panel equivalent) ───────────────────────────

function BuddyFeed({ buddy, me, onBack, st, mc, accentColor }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setData(null);
    getActivity(buddy.username).then(d => {
      if (d?.ok) setData(d);
      else setError(true);
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, [buddy.username]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Back button */}
      <TouchableOpacity style={st.backBtn} onPress={onBack}>
        <Text style={st.backTxt}>Back to Buddies</Text>
      </TouchableOpacity>

      {loading && (
        <View style={st.centered}>
          <ActivityIndicator color={accentColor} />
          <Text style={[st.dimTxt, { marginTop: 10 }]}>Loading activity...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={st.centered}>
          <Text style={st.dimTxt}>Could not load activity.</Text>
        </View>
      )}

      {data && !loading && (
        <View style={{ paddingHorizontal: 16 }}>
          {/* Profile card */}
          <View style={st.profileCard}>
            <Avatar name={data.name} size={54} st={st} />
            <View style={{ flex: 1, marginLeft: 18 }}>
              <Text style={st.pcName}>{data.name}</Text>
              <Text style={st.pcMeta}>Goal: {data.goal}</Text>
              <Text style={st.pcMeta}>Fitness: {data.fitness_level}</Text>
            </View>
            <View style={st.pcStats}>
              <View style={st.pcStat}>
                <Text style={st.pcSv}>{data.level}</Text>
                <Text style={st.pcSl}>Level</Text>
              </View>
              <View style={st.pcStat}>
                <Text style={st.pcSv}>{data.streak}</Text>
                <Text style={st.pcSl}>Streak</Text>
              </View>
              <View style={st.pcStat}>
                <Text style={st.pcSv}>{(data.xp || 0).toLocaleString()}</Text>
                <Text style={st.pcSl}>XP</Text>
              </View>
            </View>
          </View>

          {/* Trains in */}
          {!!data.exercise_types && (
            <View style={st.infoBox}>
              <Text style={st.infoBoxTxt}>
                Trains in: <Text style={{ color: mc.text }}>{data.exercise_types.replace(/,/g, ', ')}</Text>
              </Text>
            </View>
          )}

          {/* Feed header */}
          <Text style={st.feedHead}>Recent Activity</Text>

          {/* Feed items */}
          {data.feed && data.feed.length > 0 ? (
            data.feed.map(f => (
              <FeedCard key={f.id} item={f} me={me} st={st} mc={mc} accentColor={accentColor} />
            ))
          ) : (
            <Text style={st.feedNone}>No activity yet.</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SocialsScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();

  const [buddies,   setBuddies]   = useState([]);
  const [incoming,  setIncoming]  = useState([]);
  const [outgoing,  setOutgoing]  = useState([]);
  const [searchQ,   setSearchQ]   = useState('');
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDrop,  setShowDrop]  = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [activeBuddy, setActiveBuddy] = useState(null);
  const [toast,     setToast]     = useState('');
  const [me,        setMe]        = useState('');
  const searchTimer = useRef(null);

  useEffect(() => {
    getUser().then(u => setMe(u?.username || u?.name || ''));
    loadBuddies();
    const interval = setInterval(loadBuddies, 20000);
    return () => clearInterval(interval);
  }, []);

  async function loadBuddies() {
    const d = await getBuddies();
    if (d?.ok) {
      setBuddies(d.buddies || []);
      setIncoming(d.incoming || []);
      setOutgoing(d.outgoing || []);
    }
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadBuddies();
    setRefreshing(false);
  }

  function handleSearchChange(text) {
    setSearchQ(text);
    clearTimeout(searchTimer.current);
    if (text.trim().length < 2) { setShowDrop(false); setSearchRes([]); return; }
    searchTimer.current = setTimeout(() => doSearch(text.trim()), 300);
  }

  async function doSearch(q) {
    setSearching(true);
    const d = await searchUsers(q);
    setSearchRes(d?.results || []);
    setShowDrop(true);
    setSearching(false);
  }

  async function searchAct(user) {
    const { username, status, name } = user;
    if (status === 'accepted') {
      setShowDrop(false);
      setSearchQ('');
      setSearchRes([]);
      setActiveBuddy({ username, name });
      return;
    }
    if (status === 'pending_recv') {
      await respondBuddy(username, 'accept');
      showToast('You are now buddies with ' + name + '!');
    } else if (status === 'none') {
      await sendBuddyReq(username);
      showToast('Buddy request sent to ' + name);
    }
    doSearch(searchQ.trim());
    loadBuddies();
  }

  async function respond(username, action) {
    await respondBuddy(username, action);
    loadBuddies();
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }

  function openFeed(b) {
    setActiveBuddy(b);
    setShowDrop(false);
  }

  // Map status → button label / style key
  function searchBtnProps(status) {
    if (status === 'pending_sent') return { label: 'Sent', variant: 'sent' };
    if (status === 'pending_recv') return { label: 'Accept', variant: 'add' };
    if (status === 'accepted')     return { label: 'View', variant: 'buddy' };
    return { label: '+ Buddy', variant: 'add' };
  }

  const st = StyleSheet.create({
    // Panel header
    panelHead:       { paddingHorizontal: 14, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: mc.border, backgroundColor: mc.bg },
    panelTitle:      { fontFamily: F.display, fontSize: 17, color: mc.text, letterSpacing: 1, marginBottom: 12 },

    // Search
    searchWrap:      { position: 'relative', flexDirection: 'row', alignItems: 'center', backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border },
    searchIcon:      { position: 'absolute', left: 10, zIndex: 1, pointerEvents: 'none' },
    searchInp:       { flex: 1, color: mc.text, fontFamily: F.mono, fontSize: fontSize, paddingVertical: 8, paddingHorizontal: 10, paddingLeft: 32, outlineWidth: 0 },
    searchDrop:      { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: mc.elevated, borderWidth: 1, borderColor: mc.borderH, zIndex: 300, maxHeight: 260 },
    sdItem:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
    sdEmpty:         { padding: 14, alignItems: 'center' },
    sdEmptyTxt:      { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: mc.text3 },
    sdName:          { fontFamily: F.mono, fontSize: fontSize, color: mc.text },
    sdLevel:         { fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 1 },
    sdBtn:           { borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)', paddingHorizontal: 9, paddingVertical: 3 },
    sdBtnSent:       { borderColor: mc.border },
    sdBtnBuddy:      { borderColor: 'rgba(76,175,130,0.4)' },
    sdBtnTxt:        { fontFamily: F.mono, fontSize: 10, color: accentColor, letterSpacing: 0.5 },

    // Avatar
    avatar:          { backgroundColor: mc.goldDim, borderWidth: 1, borderColor: mc.borderH, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    avatarTxt:       { color: accentColor, fontFamily: F.display },

    // Buddy list labels
    blLabel:         { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 3, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
    blEmpty:         { padding: 16, paddingHorizontal: 14 },
    blEmptyTxt:      { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: mc.text3, lineHeight: 18 },

    // Buddy rows
    buddyRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: mc.border, borderLeftWidth: 2, borderLeftColor: 'transparent' },
    buddyRowActive:  { backgroundColor: 'rgba(201,168,76,0.08)', borderLeftColor: accentColor },
    brName:          { fontFamily: F.mono, fontSize: fontSize, color: mc.text },
    brSub:           { fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 2 },

    // Request rows
    reqRow:          { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: mc.border },
    reqTop:          { flexDirection: 'row', alignItems: 'center' },
    reqBtns:         { flexDirection: 'row', gap: 6, marginTop: 6, paddingLeft: 44 },
    reqBtnAcc:       { borderWidth: 1, borderColor: 'rgba(76,175,130,0.4)', paddingHorizontal: 10, paddingVertical: 3 },
    reqBtnAccTxt:    { fontFamily: F.mono, fontSize: 10, color: C.green, letterSpacing: 0.5 },
    reqBtnDec:       { borderWidth: 1, borderColor: mc.border, paddingHorizontal: 10, paddingVertical: 3 },
    reqBtnDecTxt:    { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 0.5 },

    // Feed empty state
    feedEmpty:       { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
    feedEmptyTxt:    { fontFamily: F.mono, fontSize: fontSize, color: mc.text3, letterSpacing: 1, textAlign: 'center' },
    feedEmptyHint:   { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: mc.text3, marginTop: 6, textAlign: 'center' },

    // Profile card
    profileCard:     { flexDirection: 'row', alignItems: 'center', padding: 24, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, marginBottom: 20, marginTop: 16, flexWrap: 'wrap', gap: 16 },
    pcName:          { fontFamily: F.serif, fontSize: 22, color: mc.text, marginBottom: 4 },
    pcMeta:          { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: mc.text3, lineHeight: 18, letterSpacing: 0.5 },
    pcStats:         { flexDirection: 'row', gap: 24 },
    pcStat:          { alignItems: 'center' },
    pcSv:            { fontFamily: F.serif, fontSize: 22, color: accentColor },
    pcSl:            { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },

    // Info box
    infoBox:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, borderTopWidth: 0, marginBottom: 20 },
    infoBoxTxt:      { fontFamily: F.mono, fontSize: fontSize, color: mc.text3 },

    // Feed
    feedHead:        { fontFamily: F.mono, fontSize: 11, color: mc.text3, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: mc.border },
    feedCard:        { backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.border, marginBottom: 2 },
    feedItem:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 14 },
    fiIconWrap:      { width: 30, alignItems: 'center', flexShrink: 0 },
    fiIcon:          { fontSize: 18, color: mc.text },
    fiLabel:         { fontFamily: F.mono, fontSize: fontSize, color: mc.text },
    fiNote:          { fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 2 },
    fiXp:            { fontFamily: F.serif, fontSize: 14, color: accentColor, marginRight: 6 },
    fiTime:          { fontFamily: F.mono, fontSize: 10, color: mc.text3 },
    feedNone:        { fontFamily: F.mono, fontSize: fontSize, color: mc.text3, letterSpacing: 1, paddingVertical: 20 },

    // Social bar
    socialBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, borderTopWidth: 1, borderTopColor: mc.border, gap: 8 },
    reactRow:        { flexDirection: 'row', flex: 1, gap: 4, flexWrap: 'wrap' },
    reactBtn:        { borderWidth: 1, borderColor: mc.border, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
    reactBtnActive:  { borderColor: accentColor, backgroundColor: mc.goldDim },
    reactLabel:      { fontFamily: F.mono, fontSize: 9, color: mc.text2, letterSpacing: 0.5 },
    reactCount:      { fontFamily: F.mono, fontSize: 9, color: accentColor },
    commentToggle:   { borderWidth: 1, borderColor: mc.border, paddingHorizontal: 10, paddingVertical: 3 },
    commentToggleTxt:{ fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 0.5 },

    // Comments
    commentsWrap:    { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: mc.border, gap: 5 },
    commentItem:     { fontFamily: F.mono, fontSize: fontSize, color: mc.text2, lineHeight: 18 },
    commentWho:      { color: accentColor, fontSize: Math.max(10, fontSize - 2), letterSpacing: 0.5 },
    commentForm:     { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: mc.border, gap: 6 },
    commentInp:      { flex: 1, backgroundColor: mc.elevated, borderWidth: 1, borderColor: mc.border, color: mc.text, fontFamily: F.mono, fontSize: fontSize, paddingHorizontal: 10, paddingVertical: 6, outlineWidth: 0 },
    commentSend:     { backgroundColor: accentColor, paddingHorizontal: 14, paddingVertical: 6, justifyContent: 'center' },
    commentSendTxt:  { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), fontWeight: '700', color: '#0A0A0A', letterSpacing: 1 },

    // Back button
    backBtn:         { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    backTxt:         { fontFamily: F.mono, fontSize: Math.max(10, fontSize - 2), color: mc.text3, letterSpacing: 1, textDecorationLine: 'underline' },

    // Misc
    centered:        { padding: 40, alignItems: 'center' },
    dimTxt:          { fontFamily: F.mono, fontSize: fontSize, color: mc.text3 },

    // Toast
    toast:           { position: 'absolute', bottom: 24, right: 24, backgroundColor: mc.elevated, borderWidth: 1, borderColor: mc.borderH, paddingHorizontal: 18, paddingVertical: 10, zIndex: 9000 },
    toastTxt:        { fontFamily: F.mono, fontSize: fontSize, color: accentColor, letterSpacing: 0.5 },
  });

  if (activeBuddy) {
    return (
      <View style={{ flex: 1, backgroundColor: mc.bg }}>
        <BuddyFeed buddy={activeBuddy} me={me} onBack={() => setActiveBuddy(null)} st={st} mc={mc} accentColor={accentColor} />
        {!!toast && <View style={st.toast}><Text style={st.toastTxt}>{toast}</Text></View>}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: mc.bg }}>
      {/* Header + Search */}
      <View style={st.panelHead}>
        <Text style={st.panelTitle}>Socials</Text>
        <View style={st.searchWrap}>
          <View style={st.searchIcon}><SearchIcon mc={mc} /></View>
          <TextInput
            style={st.searchInp}
            value={searchQ}
            onChangeText={handleSearchChange}
            placeholder="Search by username..."
            placeholderTextColor={mc.text3}
            autoComplete="off"
            autoCorrect={false}
            onBlur={() => setTimeout(() => setShowDrop(false), 200)}
          />
        </View>

        {/* Search dropdown */}
        {showDrop && (
          <View style={st.searchDrop}>
            {searching && (
              <View style={st.sdEmpty}>
                <ActivityIndicator color={accentColor} size="small" />
              </View>
            )}
            {!searching && searchRes.length === 0 && (
              <View style={st.sdEmpty}>
                <Text style={st.sdEmptyTxt}>No users found.</Text>
              </View>
            )}
            {!searching && searchRes.map(u => {
              const { label, variant } = searchBtnProps(u.status);
              return (
                <View key={u.username} style={st.sdItem}>
                  <Avatar name={u.name || u.username} size={30} st={st} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={st.sdName}>{u.name || u.username}</Text>
                    <Text style={st.sdLevel}>Lv {u.level}</Text>
                  </View>
                  <TouchableOpacity
                    style={[st.sdBtn, variant === 'sent' && st.sdBtnSent, variant === 'buddy' && st.sdBtnBuddy]}
                    onPress={() => variant !== 'sent' && searchAct(u)}
                    disabled={variant === 'sent'}
                  >
                    <Text style={[st.sdBtnTxt,
                      variant === 'sent'  && { color: mc.text3 },
                      variant === 'buddy' && { color: C.green },
                    ]}>{label}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Buddy scroll area */}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
      >
        {loading && (
          <View style={st.centered}>
            <ActivityIndicator color={accentColor} />
          </View>
        )}

        {!loading && incoming.length === 0 && outgoing.length === 0 && buddies.length === 0 && (
          <View style={st.blEmpty}>
            <Text style={st.blEmptyTxt}>No buddies yet.</Text>
            <Text style={[st.blEmptyTxt, { fontSize: 10, marginTop: 4 }]}>Use the search bar to find people.</Text>
          </View>
        )}

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <>
            <Text style={st.blLabel}>Requests ({incoming.length})</Text>
            {incoming.map(b => (
              <View key={b.username} style={st.reqRow}>
                <View style={st.reqTop}>
                  <Avatar name={b.name || b.username} size={34} st={st} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={st.brName}>{b.name || b.username}</Text>
                    <Text style={st.brSub}>Level {b.level} · wants to be your buddy</Text>
                  </View>
                </View>
                <View style={st.reqBtns}>
                  <TouchableOpacity style={st.reqBtnAcc} onPress={() => respond(b.username, 'accept')}>
                    <Text style={st.reqBtnAccTxt}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.reqBtnDec} onPress={() => respond(b.username, 'reject')}>
                    <Text style={st.reqBtnDecTxt}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Outgoing (sent) */}
        {outgoing.length > 0 && (
          <>
            <Text style={st.blLabel}>Sent</Text>
            {outgoing.map(b => (
              <View key={b.username} style={[st.buddyRow, { opacity: 0.5 }]}>
                <Avatar name={b.name || b.username} size={34} st={st} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={st.brName}>{b.name || b.username}</Text>
                  <Text style={st.brSub}>Request pending...</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Accepted buddies */}
        {buddies.length > 0 && (
          <>
            <Text style={st.blLabel}>Buddies ({buddies.length})</Text>
            {buddies.map(b => (
              <TouchableOpacity
                key={b.username}
                style={[st.buddyRow, activeBuddy?.username === b.username && st.buddyRowActive]}
                onPress={() => openFeed(b)}
              >
                <Avatar name={b.name || b.username} size={34} st={st} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={st.brName}>{b.name || b.username}</Text>
                  <Text style={st.brSub}>
                    Lv {b.level}{b.streak > 0 ? ' · ' + b.streak + 'd streak' : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Empty feed hint */}
        {!loading && (
          <View style={st.feedEmpty}>
            <Text style={st.feedEmptyTxt}>Select a buddy to view their activity</Text>
            <Text style={st.feedEmptyHint}>Search by username above to send a buddy request first</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Toast */}
      {!!toast && (
        <View style={st.toast}>
          <Text style={st.toastTxt}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

