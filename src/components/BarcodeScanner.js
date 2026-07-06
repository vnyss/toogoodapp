import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path, Line, Rect, Circle, Polyline } from 'react-native-svg';
import { C, F } from '../theme';
import { BrowserMultiFormatReader } from '@zxing/browser';

// status: 'init' | 'scanning' | 'denied' | 'no-camera' | 'error'

export default function BarcodeScanner({ visible, onScanned, onClose }) {
  const videoRef      = useRef(null);
  const controlsRef   = useRef(null);
  const fileInputRef  = useRef(null);
  const [status,      setStatus]     = useState('init');
  const [manualCode,  setManualCode] = useState('');
  const [imgError,    setImgError]   = useState('');
  const [imgLoading,  setImgLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setStatus('init');
    setManualCode('');
    setImgError('');

    async function start() {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true });
        probe.getTracks().forEach(t => t.stop());
        if (cancelled) return;

        const reader  = new BrowserMultiFormatReader();
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length === 0) { setStatus('no-camera'); return; }
        const camera  = devices.find(d => /back|environment|rear/i.test(d.label)) || devices[0];

        setStatus('scanning');

        const controls = await reader.decodeFromVideoDevice(
          camera.deviceId,
          videoRef.current,
          (result) => { if (result && !cancelled) onScanned(result.getText()); }
        );
        if (cancelled) { controls.stop(); return; }
        controlsRef.current = controls;
      } catch (e) {
        if (cancelled) return;
        if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') setStatus('denied');
        else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') setStatus('no-camera');
        else setStatus('error');
      }
    }

    start();
    return () => {
      cancelled = true;
      if (controlsRef.current) { controlsRef.current.stop(); controlsRef.current = null; }
    };
  }, [visible]);

  function submitManual() {
    const code = manualCode.trim().replace(/\s/g, '');
    if (code.length >= 4) { onScanned(code); setManualCode(''); }
  }

  async function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgError('');
    setImgLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(url);
      if (result) {
        onScanned(result.getText());
      } else {
        setImgError('No barcode found in that image.');
      }
    } catch {
      setImgError('No barcode found in that image.');
    } finally {
      URL.revokeObjectURL(url);
      setImgLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const cameraFailed = status === 'denied' || status === 'no-camera' || status === 'error';
  const cameraMsg    = status === 'denied'   ? 'Camera access blocked. Allow it in system settings, then reopen Too Good.'
                     : status === 'no-camera' ? 'No camera detected.'
                     :                          'Could not start the camera.';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      {/* hidden file input */}
      {React.createElement('input', {
        type: 'file',
        accept: 'image/*',
        ref: fileInputRef,
        style: { display: 'none' },
        onChange: handleImageFile,
      })}

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

        {/* Camera area */}
        <View style={s.videoWrap}>
          {React.createElement('video', {
            ref: videoRef,
            style: {
              width: '100%', height: '100%', objectFit: 'cover',
              display: cameraFailed ? 'none' : 'block',
            },
            autoPlay: true,
            playsInline: true,
            muted: true,
          })}

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

          {cameraFailed && (
            <View style={s.msgOverlay}>
              <View style={s.msgIconBox}>
                {status === 'denied' ? (
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.4} strokeLinecap="round">
                    <Circle cx="12" cy="12" r="10" /><Line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </Svg>
                ) : (
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.4} strokeLinecap="round">
                    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <Circle cx="12" cy="13" r="4" />
                    <Line x1="1" y1="1" x2="23" y2="23" />
                  </Svg>
                )}
              </View>
              <Text style={s.msgText}>{cameraMsg}</Text>
            </View>
          )}
        </View>

        {/* Bottom panel — always visible */}
        <View style={s.bottomPanel}>
          {/* Manual entry row */}
          <View style={s.manualRow}>
            <TextInput
              style={s.manualInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="Type barcode number…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="number-pad"
              onSubmitEditing={submitManual}
            />
            <TouchableOpacity style={s.manualBtn} onPress={submitManual}>
              <Text style={s.manualBtnTxt}>Look up →</Text>
            </TouchableOpacity>
          </View>

          {/* Image import row */}
          <TouchableOpacity
            style={s.importBtn}
            onPress={() => { setImgError(''); fileInputRef.current?.click(); }}
            disabled={imgLoading}
          >
            {imgLoading ? (
              <ActivityIndicator color={C.gold} size="small" />
            ) : (
              <>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                  <Rect x="3" y="3" width="18" height="18" rx="2" />
                  <Circle cx="8.5" cy="8.5" r="1.5" />
                  <Polyline points="21 15 16 10 5 21" />
                </Svg>
                <Text style={s.importBtnTxt}>Import photo of barcode</Text>
              </>
            )}
          </TouchableOpacity>

          {!!imgError && <Text style={s.imgErrorTxt}>{imgError}</Text>}
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
  bottomPanel:  { backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', padding: 16, gap: 10 },
  manualRow:    { flexDirection: 'row', gap: 8 },
  manualInput:  { flex: 1, fontFamily: F.mono, fontSize: 14, color: '#fff', borderWidth: 1, borderColor: C.gold, paddingHorizontal: 12, paddingVertical: 10, outlineWidth: 0 },
  manualBtn:    { backgroundColor: C.gold, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
  manualBtnTxt: { fontFamily: F.mono, fontSize: 12, color: '#000', letterSpacing: 1 },
  importBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingVertical: 10, paddingHorizontal: 16 },
  importBtnTxt: { fontFamily: F.mono, fontSize: 12, color: C.gold, letterSpacing: 1 },
  imgErrorTxt:  { fontFamily: F.mono, fontSize: 11, color: '#e57373', textAlign: 'center', letterSpacing: 0.5 },
});
