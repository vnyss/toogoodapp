import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Image, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser } from '../auth';
import { TrendLine } from '../components/Charts';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  return new Date(iso + 'T12:00').toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function TransformationScreen() {
  const { mc, accentColor } = useTheme();
  const [photos,      setPhotos]      = useState([]);
  const [storageKey,  setStorageKey]  = useState(null);
  const [compareA,    setCompareA]    = useState(null);
  const [compareB,    setCompareB]    = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [full,        setFull]        = useState(null);
  const [weightLogs,  setWeightLogs]  = useState([]);
  const fileInputRef  = useRef(null);

  useEffect(() => {
    getUser().then(async u => {
      const key = `tg_transform_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) setPhotos(JSON.parse(raw));

      const dailyRaw = await AsyncStorage.getItem(`toogood_daily_logs_${u}`);
      if (dailyRaw) setWeightLogs(JSON.parse(dailyRaw));
    });
  }, []);

  const weightPts = weightLogs
    .filter(d => d.weight && parseFloat(d.weight) > 0)
    .map(d => ({ x: d.date, y: parseFloat(d.weight) }))
    .sort((a, b) => a.x.localeCompare(b.x))
    .slice(-60);

  async function persist(updated) {
    if (!storageKey) return;
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const photo = { id: Date.now(), date: todayISO(), uri: ev.target.result, note: '' };
      const updated = [photo, ...photos];
      setPhotos(updated);
      persist(updated);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  }

  function deletePhoto(id) {
    const updated = photos.filter(p => p.id !== id);
    setPhotos(updated);
    persist(updated);
    if (compareA?.id === id) setCompareA(null);
    if (compareB?.id === id) setCompareB(null);
    setFull(null);
  }

  const st = StyleSheet.create({
    root:     { flex: 1, backgroundColor: mc.bg },
    content:  { padding: 20, maxWidth: 700, alignSelf: 'center', width: '100%', paddingBottom: 40 },
    title:    { fontFamily: F.serif, fontSize: 24, color: mc.text, marginBottom: 4 },
    sub:      { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 24 },
    addBtn:   { backgroundColor: accentColor, paddingVertical: 14, alignItems: 'center', marginBottom: 24 },
    addTxt:   { fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700', letterSpacing: 1 },
    grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    thumb:    { width: '30%', aspectRatio: 0.75 },
    thumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    thumbDate:{ fontFamily: F.mono, fontSize: 9, color: mc.text3, marginTop: 4, textAlign: 'center' },
    cmpBtn:   { borderWidth: 1, borderColor: mc.border, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
    cmpTxt:   { fontFamily: F.mono, fontSize: 11, color: mc.text2, letterSpacing: 1 },
    section:  { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 14, marginTop: 8 },
    selRow:   { flexDirection: 'row', gap: 12, marginBottom: 20 },
    selSlot:  { flex: 1, borderWidth: 1, borderColor: mc.border, alignItems: 'center', justifyContent: 'center', minHeight: 120 },
    selTxt:   { fontFamily: F.mono, fontSize: 11, color: mc.text3 },
  });

  const selectedIds = new Set([compareA?.id, compareB?.id].filter(Boolean));

  return (
    <ScrollView style={st.root}>
      <View style={st.content}>
        <Text style={st.title}>Transformation Photos</Text>
        <Text style={st.sub}>TRACK YOUR VISUAL PROGRESS</Text>

        <TouchableOpacity style={st.addBtn} onPress={() => Platform.OS === 'web' && fileInputRef.current?.click()}>
          <Text style={st.addTxt}>ADD PROGRESS PHOTO</Text>
        </TouchableOpacity>

        {Platform.OS === 'web' && React.createElement('input', {
          ref: fileInputRef, type: 'file', accept: 'image/*',
          style: { display: 'none' }, onChange: handleFileChange,
        })}

        {weightPts.length >= 2 && (
          <View style={{ borderWidth: 1, borderColor: mc.border, padding: 16, marginBottom: 24 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 10 }}>WEIGHT TREND</Text>
            <TrendLine points={weightPts} color={accentColor} mc={mc} height={110} showDots fill />
            <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, marginTop: 8 }}>
              {weightPts[0].y.toFixed(1)}kg → {weightPts[weightPts.length - 1].y.toFixed(1)}kg over {weightPts.length} logged days
            </Text>
          </View>
        )}

        {photos.length >= 2 && (
          <>
            <Text style={st.section}>SIDE-BY-SIDE COMPARISON</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 12 }}>
              Tap two photos below to compare them side by side.
            </Text>

            {compareA && compareB ? (
              <>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Image source={{ uri: compareA.uri }} style={{ width: '100%', aspectRatio: 0.75, resizeMode: 'cover' }} />
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 4 }}>{fmtDate(compareA.date)}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Image source={{ uri: compareB.uri }} style={{ width: '100%', aspectRatio: 0.75, resizeMode: 'cover' }} />
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 4 }}>{fmtDate(compareB.date)}</Text>
                  </View>
                </View>
                <TouchableOpacity style={st.cmpBtn} onPress={() => { setCompareA(null); setCompareB(null); }}>
                  <Text style={st.cmpTxt}>CLEAR COMPARISON</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor, marginBottom: 16 }}>
                {compareA ? 'Now tap a second photo to compare' : 'Tap a photo below to start'}
              </Text>
            )}
          </>
        )}

        {photos.length > 0 && (
          <>
            <Text style={st.section}>ALL PHOTOS ({photos.length})</Text>
            <View style={st.grid}>
              {photos.map(p => {
                const isSelected = selectedIds.has(p.id);
                const isA = compareA?.id === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[st.thumb, isSelected && { borderWidth: 2, borderColor: accentColor }]}
                    onPress={() => {
                      if (!compareA) { setCompareA(p); return; }
                      if (!compareB && p.id !== compareA.id) { setCompareB(p); return; }
                      setFull(p);
                    }}
                    onLongPress={() => setFull(p)}
                  >
                    <Image source={{ uri: p.uri }} style={st.thumbImg} />
                    {isSelected && (
                      <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: accentColor, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 10, color: '#0A0A0A', fontWeight: '700' }}>{isA ? 'A' : 'B'}</Text>
                      </View>
                    )}
                    <Text style={st.thumbDate}>{fmtDate(p.date)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {photos.length === 0 && (
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text3, textAlign: 'center', marginTop: 40 }}>
            No photos yet.{'\n'}Add your first progress photo to start tracking your transformation.
          </Text>
        )}
      </View>

      {/* Full-screen photo view */}
      <Modal visible={!!full} transparent animationType="fade" onRequestClose={() => setFull(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          {full && (
            <>
              <Image source={{ uri: full.uri }} style={{ width: '100%', maxWidth: 500, aspectRatio: 0.75, resizeMode: 'contain' }} />
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#ccc', marginTop: 12 }}>{fmtDate(full.date)}</Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 20 }}>
                <TouchableOpacity onPress={() => setFull(null)} style={{ borderWidth: 1, borderColor: '#555', paddingHorizontal: 20, paddingVertical: 10 }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#ccc' }}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deletePhoto(full.id)} style={{ borderWidth: 1, borderColor: '#E57373', paddingHorizontal: 20, paddingVertical: 10 }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#E57373' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}
