import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { C, F } from '../theme';

export default function BarcodeScanner({ visible, onScanned, onClose }) {
  const videoRef  = useRef(null);
  const readerRef = useRef(null);
  const [status, setStatus] = useState('init');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setStatus('init');

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled) return;

        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices.length) { setStatus('no-camera'); return; }
        if (cancelled) return;

        // Prefer rear/environment camera on phones
        const deviceId = devices.find(d => /back|rear|environment/i.test(d.label))?.deviceId
          || devices[devices.length - 1]?.deviceId;

        setStatus('scanning');

        await reader.decodeFromVideoDevice(
          deviceId || undefined,
          videoRef.current,
          (result) => {
            if (cancelled || !result) return;
            onScanned(result.getText());
          },
        );
      } catch (e) {
        if (!cancelled) setStatus('error');
      }
    }

    start();

    return () => {
      cancelled = true;
      try { readerRef.current?.reset(); } catch {}
      readerRef.current = null;
    };
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>SCAN BARCODE</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Camera view */}
        <View style={s.videoWrap}>
          {React.createElement('video', {
            ref: videoRef,
            style: { width: '100%', height: '100%', objectFit: 'cover' },
            autoPlay: true,
            playsInline: true,
            muted: true,
          })}

          {/* Targeting frame overlay */}
          <View style={s.overlay} pointerEvents="none">
            <View style={s.frame}>
              <View style={[s.corner, s.tl]} />
              <View style={[s.corner, s.tr]} />
              <View style={[s.corner, s.bl]} />
              <View style={[s.corner, s.br]} />
            </View>
            <Text style={s.hint}>Point camera at a product barcode</Text>
          </View>

          {status === 'init' && (
            <View style={s.startingOverlay}>
              <ActivityIndicator color={C.gold} size="large" />
              <Text style={s.startingText}>Starting camera…</Text>
            </View>
          )}
          {status === 'no-camera' && (
            <View style={s.startingOverlay}>
              <Text style={s.startingText}>No camera found</Text>
            </View>
          )}
          {status === 'error' && (
            <View style={s.startingOverlay}>
              <Text style={s.startingText}>Camera access denied{'\n'}Allow camera in browser settings</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const CORNER = 20;
const BORDER = 3;
const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#000' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 48, backgroundColor: C.sidebar },
  title:         { fontFamily: F.mono, fontSize: 12, color: C.text2, letterSpacing: 6 },
  closeBtn:      { padding: 8 },
  closeText:     { fontFamily: F.mono, fontSize: 18, color: C.text2 },
  videoWrap:     { flex: 1, position: 'relative', backgroundColor: '#000' },
  overlay:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame:         { width: 260, height: 160, position: 'relative' },
  corner:        { position: 'absolute', width: CORNER, height: CORNER, borderColor: C.gold },
  tl:            { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER },
  tr:            { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER },
  bl:            { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER },
  br:            { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER },
  hint:          { marginTop: 24, fontFamily: F.mono, fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textAlign: 'center' },
  startingOverlay:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', gap: 14 },
  startingText:  { fontFamily: F.mono, fontSize: 13, color: C.text2, letterSpacing: 1, textAlign: 'center' },
});
