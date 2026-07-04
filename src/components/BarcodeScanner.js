import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path, Line, Rect, Circle } from 'react-native-svg';
import { C, F } from '../theme';

// status values: 'init' | 'scanning' | 'no-detector' | 'denied' | 'no-camera' | 'error'

export default function BarcodeScanner({ visible, onScanned, onClose }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const [status,    setStatus]    = useState('init');
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setStatus('init');
    setManualCode('');

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        if (!('BarcodeDetector' in window)) {
          setStatus('no-detector');
          return;
        }

        const detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'code_128', 'code_39', 'itf'],
        });

        setStatus('scanning');

        async function tick() {
          if (cancelled) return;
          try {
            if (videoRef.current?.readyState >= 2) {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0 && !cancelled) {
                onScanned(codes[0].rawValue);
                return;
              }
            }
          } catch {}
          if (!cancelled) rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);

      } catch (e) {
        if (cancelled) return;
        if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
          setStatus('denied');
        } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
          setStatus('no-camera');
        } else {
          setStatus('no-detector');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [visible]);

  function submitManual() {
    const code = manualCode.trim().replace(/\s/g, '');
    if (code.length >= 4) { onScanned(code); setManualCode(''); }
  }

  const showManual = status === 'denied' || status === 'no-camera' || status === 'no-detector' || status === 'error';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>SCAN BARCODE</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.8} strokeLinecap="round">
              <Line x1="18" y1="6" x2="6" y2="18" />
              <Line x1="6" y1="6" x2="18" y2="18" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Camera view */}
        <View style={s.videoWrap}>
          {React.createElement('video', {
            ref: videoRef,
            style: { width: '100%', height: '100%', objectFit: 'cover', display: showManual ? 'none' : 'block' },
            autoPlay: true,
            playsInline: true,
            muted: true,
          })}

          {/* Targeting frame (shown while scanning) */}
          {status === 'scanning' && (
            <View style={s.overlay} pointerEvents="none">
              <View style={s.frame}>
                <View style={[s.corner, s.tl]} />
                <View style={[s.corner, s.tr]} />
                <View style={[s.corner, s.bl]} />
                <View style={[s.corner, s.br]} />
              </View>
              <Text style={s.hint}>Point camera at a product barcode</Text>
            </View>
          )}

          {status === 'init' && (
            <View style={s.msgOverlay}>
              <ActivityIndicator color={C.gold} size="large" />
              <Text style={s.msgText}>Starting camera…</Text>
            </View>
          )}

          {/* Manual entry fallback */}
          {showManual && (
            <View style={s.msgOverlay}>
              <View style={s.msgIconBox}>
                {status === 'denied' ? (
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.4} strokeLinecap="round">
                    <Circle cx="12" cy="12" r="10" />
                    <Line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </Svg>
                ) : status === 'no-camera' ? (
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.4} strokeLinecap="round">
                    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <Circle cx="12" cy="13" r="4" />
                    <Line x1="1" y1="1" x2="23" y2="23" />
                  </Svg>
                ) : (
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.4} strokeLinecap="round">
                    <Rect x="2" y="3" width="20" height="14" rx="2" />
                    <Path d="M8 21h8M12 17v4" />
                  </Svg>
                )}
              </View>
              <Text style={s.msgText}>
                {status === 'denied'
                  ? 'Camera access was blocked.\nAllow camera in your browser settings\nthen reload, or enter the barcode manually.'
                  : status === 'no-camera'
                  ? 'No camera detected.\nEnter the barcode number manually.'
                  : 'Barcode scanning not supported in this browser.\nTry Chrome or Edge, or enter the number manually.'}
              </Text>
              <View style={s.manualRow}>
                <TextInput
                  style={s.manualInput}
                  value={manualCode}
                  onChangeText={setManualCode}
                  placeholder="e.g. 8901030783186"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="number-pad"
                  onSubmitEditing={submitManual}
                  autoFocus
                />
                <TouchableOpacity style={s.manualBtn} onPress={submitManual}>
                  <Text style={s.manualBtnTxt}>Look up →</Text>
                </TouchableOpacity>
              </View>
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
  root:         { flex: 1, backgroundColor: '#000' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 48, backgroundColor: C.sidebar },
  title:        { fontFamily: F.mono, fontSize: 12, color: C.text2, letterSpacing: 6 },
  closeBtn:     { padding: 8, alignItems: 'center', justifyContent: 'center' },
  videoWrap:    { flex: 1, position: 'relative', backgroundColor: '#000' },
  overlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame:        { width: 260, height: 160, position: 'relative' },
  corner:       { position: 'absolute', width: CORNER, height: CORNER, borderColor: C.gold },
  tl:           { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER },
  tr:           { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER },
  bl:           { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER },
  br:           { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER },
  hint:         { marginTop: 24, fontFamily: F.mono, fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textAlign: 'center' },
  msgOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  msgIconBox:   { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  msgText:      { fontFamily: F.mono, fontSize: 13, color: C.text2, letterSpacing: 0.5, textAlign: 'center', lineHeight: 22 },
  manualRow:    { flexDirection: 'row', gap: 8, marginTop: 8, width: '100%', maxWidth: 360 },
  manualInput:  { flex: 1, fontFamily: F.mono, fontSize: 14, color: '#fff', borderWidth: 1, borderColor: C.gold, paddingHorizontal: 12, paddingVertical: 10, outlineWidth: 0 },
  manualBtn:    { backgroundColor: C.gold, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
  manualBtnTxt: { fontFamily: F.mono, fontSize: 12, color: '#000', letterSpacing: 1 },
});
