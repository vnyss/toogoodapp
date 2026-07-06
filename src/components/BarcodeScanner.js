import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated, Easing,
} from 'react-native';
import Svg, { Path, Polyline, Circle, Line } from 'react-native-svg';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';
import { lookupBarcode } from '../api';

const CAM_H = 260;

export default function BarcodeScanner({ visible, onClose, onAdd }) {
  const { mc, accentColor } = useTheme();

  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const intervalRef  = useRef(null);
  const fileInputRef = useRef(null);
  const scanLineY    = useRef(new Animated.Value(0)).current;
  const handledRef   = useRef(false);

  const [phase,      setPhase]     = useState('scanning');
  const [hint,       setHint]      = useState('Point camera at the barcode on any food package.');
  const [product,    setProduct]   = useState(null);
  const [errorMsg,   setErrorMsg]  = useState('');
  const [cameraFail, setCameraFail]= useState(false);
  const [manualCode, setManualCode]= useState('');
  const [imgLoading, setImgLoading]= useState(false);
  const [capturing,  setCapturing] = useState(false);
  const [restartKey, setRestartKey]= useState(0);

  // Animated scan line
  useEffect(() => {
    if (!visible) return;
    scanLineY.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, { toValue: 1, duration: 2000, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(scanLineY, { toValue: 0, duration: 2000, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [visible, restartKey]);

  // Camera lifecycle — exact same approach as the Metabollism website
  useEffect(() => {
    if (!visible) return;

    setPhase('scanning');
    setHint('Point camera at the barcode on any food package.');
    setProduct(null);
    setErrorMsg('');
    setCameraFail(false);
    setManualCode('');
    handledRef.current = false;

    let cancelled = false;

    function stopAll() {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    }

    async function start() {
      // Try multiple camera constraints (same as website)
      const constraints = [
        { video: { facingMode: { ideal: 'environment' } } },
        { video: { facingMode: 'user' } },
        { video: true },
      ];

      let stream = null;
      for (const c of constraints) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch {}
      }

      if (!stream || cancelled) {
        if (!cancelled) {
          setCameraFail(true);
          setPhase('error');
          setErrorMsg('Camera access blocked. Allow camera in system settings, then retry.');
        }
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video || cancelled) { stopAll(); return; }

      video.srcObject = stream;
      try { await video.play(); } catch {}
      if (cancelled) { stopAll(); return; }

      setHint('Auto-scanning… point camera at any barcode.');

      const onDetected = async (code) => {
        if (handledRef.current || cancelled) return;
        handledRef.current = true;
        stopAll();
        await doLookup(code);
      };

      // Native BarcodeDetector (built into Electron's Chromium — fastest, same as website)
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });
          intervalRef.current = setInterval(async () => {
            if (handledRef.current || cancelled) return;
            if (!video.readyState || video.readyState < 2) return;
            try {
              const codes = await detector.detect(video);
              if (codes.length) onDetected(codes[0].rawValue);
            } catch {}
          }, 150);
          return;
        } catch {} // fall through to ZXing if BarcodeDetector init fails
      }

      // ZXing fallback (same as website fallback)
      const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
      const reader = new BrowserMultiFormatReader(hints, 300);
      intervalRef.current = setInterval(async () => {
        if (handledRef.current || cancelled) return;
        if (!video.readyState || video.readyState < 2) return;
        try {
          const result = await reader.decodeFromVideoElement(video);
          if (result) onDetected(result.getText());
        } catch {}
      }, 300);
    }

    start();
    return () => {
      cancelled = true;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    };
  }, [visible, restartKey]);

  async function doLookup(code) {
    setPhase('loading');
    setHint('Found barcode ' + code + ' — looking up product…');
    try {
      const p = await lookupBarcode(code);
      setProduct(p);
      setPhase('result');
    } catch {
      setPhase('error');
      setErrorMsg('Product not found. Try entering the barcode manually below.');
    }
  }

  // Capture current frame and decode
  async function captureFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) { setHint('Camera not ready — try again.'); return; }
    setCapturing(true);
    try {
      // Try native BarcodeDetector first
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });
          const codes = await detector.detect(video);
          if (codes.length && !handledRef.current) {
            handledRef.current = true;
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            await doLookup(codes[0].rawValue);
            return;
          }
        } catch {}
      }
      // ZXing fallback via canvas blob
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const blobUrl = URL.createObjectURL(blob);
      try {
        const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
        const result = await new BrowserMultiFormatReader(hints).decodeFromImageUrl(blobUrl);
        if (result && !handledRef.current) {
          handledRef.current = true;
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
          await doLookup(result.getText());
        } else {
          setHint('No barcode detected — hold it steady and try again.');
        }
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      setHint('No barcode detected — hold it steady and try again.');
    } finally {
      setCapturing(false);
    }
  }

  async function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
      const result = await new BrowserMultiFormatReader(hints).decodeFromImageUrl(url);
      if (result) {
        handledRef.current = true;
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        await doLookup(result.getText());
      } else {
        setPhase('error');
        setErrorMsg('No barcode found in that image. Try a clearer photo.');
      }
    } catch {
      setPhase('error');
      setErrorMsg('No barcode found in that image. Try a clearer photo.');
    } finally {
      URL.revokeObjectURL(url);
      setImgLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function lookupManual() {
    const code = manualCode.trim().replace(/\s/g, '');
    if (!code) return;
    handledRef.current = true;
    await doLookup(code);
  }

  function doAdd() {
    if (product && onAdd) onAdd(product);
    setPhase('added');
  }

  function scanAnother() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    handledRef.current = false;
    setRestartKey(k => k + 1);
  }

  const scanLineTop = scanLineY.interpolate({ inputRange: [0, 1], outputRange: ['20%', '78%'] });
  const s = makeStyles(mc, accentColor);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {React.createElement('input', {
        type: 'file', accept: 'image/*', ref: fileInputRef,
        style: { display: 'none' }, onChange: handleImageFile,
      })}
      <View style={s.overlay}>
        <View style={s.box}>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Barcode Scanner</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Camera */}
          <View style={s.camArea}>
            {React.createElement('video', {
              ref: videoRef, autoPlay: true, playsInline: true, muted: true,
              style: { width: '100%', height: '100%', objectFit: 'cover', display: cameraFail ? 'none' : 'block' },
            })}
            {!cameraFail && (
              <>
                <View style={s.scanFrame} />
                <Animated.View style={[s.scanLine, { top: scanLineTop }]} />
              </>
            )}
            {cameraFail && (
              <View style={s.camFailOverlay}>
                <Svg width={36} height={36} viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.25)" strokeWidth={1.4} strokeLinecap="round">
                  <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <Circle cx="12" cy="13" r="4" />
                  <Line x1="1" y1="1" x2="23" y2="23" />
                </Svg>
                <Text style={s.camFailTxt}>No camera</Text>
              </View>
            )}
          </View>

          {/* Controls below camera */}
          {phase === 'scanning' && (
            <View style={s.controlsRow}>
              <TouchableOpacity style={s.photoBtn} onPress={() => fileInputRef.current?.click()} disabled={imgLoading}>
                {imgLoading ? <ActivityIndicator size="small" color={accentColor} /> : (
                  <>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth={2.5} strokeLinecap="round">
                      <Path d="M12 5v14M5 12h14" />
                    </Svg>
                    <Text style={s.photoBtnTxt}>Add photo</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[s.captureBtn, (capturing || cameraFail) && s.captureBtnDisabled]} onPress={captureFrame} disabled={capturing || cameraFail}>
                {capturing ? <ActivityIndicator size="small" color="#060606" /> : (
                  <>
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#060606" strokeWidth={2.2} strokeLinecap="round">
                      <Circle cx="12" cy="12" r="10" /><Circle cx="12" cy="12" r="4" />
                    </Svg>
                    <Text style={s.captureBtnTxt}>Capture</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Hint / Loading */}
          {(phase === 'scanning' || phase === 'loading') && (
            <View style={s.hintRow}>
              {phase === 'loading' && <ActivityIndicator size="small" color={accentColor} style={{ marginRight: 8 }} />}
              <Text style={s.hintTxt}>{hint}</Text>
            </View>
          )}

          {/* Result */}
          {phase === 'result' && product && (
            <View style={s.resultSection}>
              <Text style={s.productName}>{product.name}</Text>
              <Text style={s.brand}>{product.brand || 'per 100g'}</Text>
              <View style={s.macroGrid}>
                <View style={s.macroBox}><Text style={s.macroVal}>{product.calories}</Text><Text style={s.macroLbl}>kcal</Text></View>
                <View style={s.macroBox}><Text style={s.macroVal}>{product.protein}g</Text><Text style={s.macroLbl}>Protein</Text></View>
                <View style={s.macroBox}><Text style={s.macroVal}>{product.carbs}g</Text><Text style={s.macroLbl}>Carbs</Text></View>
                <View style={s.macroBox}><Text style={s.macroVal}>{product.fat}g</Text><Text style={s.macroLbl}>Fat</Text></View>
              </View>
              <Text style={s.serving}>Serving size: {product.serving} — values shown per 100g</Text>
              <View style={s.actions}>
                <TouchableOpacity style={s.primaryBtn} onPress={doAdd}><Text style={s.primaryBtnTxt}>Add to Today's Log</Text></TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={scanAnother}><Text style={s.secondaryBtnTxt}>Scan another</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {/* Added */}
          {phase === 'added' && (
            <View style={s.resultSection}>
              <View style={s.addedRow}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#4CAF7C" strokeWidth={2.5} strokeLinecap="round">
                  <Polyline points="20 6 9 17 4 12" />
                </Svg>
                <Text style={s.addedTxt}>Added to today's log</Text>
              </View>
              <View style={s.actions}>
                <TouchableOpacity style={s.primaryBtn} onPress={scanAnother}><Text style={s.primaryBtnTxt}>Scan another</Text></TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={onClose}><Text style={s.secondaryBtnTxt}>Close</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {/* Error */}
          {phase === 'error' && (
            <View style={s.errorSection}>
              {cameraFail ? (
                <>
                  <Text style={s.errorMsg}>{errorMsg}</Text>
                  <TouchableOpacity style={[s.photoBtn, { marginBottom: 14 }]} onPress={() => fileInputRef.current?.click()} disabled={imgLoading}>
                    {imgLoading ? <ActivityIndicator size="small" color={accentColor} /> : (
                      <><Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth={2.5} strokeLinecap="round"><Path d="M12 5v14M5 12h14" /></Svg><Text style={s.photoBtnTxt}>Import photo of barcode</Text></>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.secondaryBtn, { marginBottom: 10 }]} onPress={scanAnother}>
                    <Text style={s.secondaryBtnTxt}>Retry camera</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={s.errorMsg}>{errorMsg}</Text>
              )}
              <Text style={s.manualLabel}>Or enter barcode manually:</Text>
              <TextInput
                style={s.manualInput} value={manualCode} onChangeText={setManualCode}
                placeholder="e.g. 5000159396914" placeholderTextColor={mc.text3}
                keyboardType="number-pad" onSubmitEditing={lookupManual}
              />
              <TouchableOpacity style={[s.primaryBtn, { width: '100%' }]} onPress={lookupManual}>
                <Text style={s.primaryBtnTxt}>Look up</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

function makeStyles(mc, accentColor) {
  return StyleSheet.create({
    overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
    box:         { width: 480, maxWidth: '100%', backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.borderH },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: mc.border },
    headerTitle: { fontFamily: F.display, fontSize: 17, color: mc.text, letterSpacing: 0.4 },
    closeBtn:    { width: 28, height: 28, borderWidth: 1, borderColor: mc.border, alignItems: 'center', justifyContent: 'center' },
    closeTxt:    { color: mc.text2, fontSize: 16, lineHeight: 20 },
    camArea:       { width: '100%', height: CAM_H, backgroundColor: '#000', overflow: 'hidden', position: 'relative' },
    scanFrame:     { position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '20%', borderWidth: 1.5, borderColor: accentColor },
    scanLine:      { position: 'absolute', left: '20%', right: '20%', height: 1, backgroundColor: accentColor },
    camFailOverlay:{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', gap: 10 },
    camFailTxt:    { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: F.mono, letterSpacing: 0.5 },
    controlsRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: mc.border, gap: 10 },
    photoBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: mc.border, paddingVertical: 8, paddingHorizontal: 14 },
    photoBtnTxt:    { fontFamily: F.mono, fontSize: 11, color: mc.text2, letterSpacing: 0.5 },
    captureBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: accentColor, paddingVertical: 8, paddingHorizontal: 16 },
    captureBtnDisabled: { opacity: 0.6 },
    captureBtnTxt:  { fontFamily: F.mono, fontSize: 11, color: '#060606', fontWeight: '700', letterSpacing: 0.8 },
    hintRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 12 },
    hintTxt:     { fontSize: 12, color: mc.text2, fontStyle: 'italic', fontFamily: F.mono, letterSpacing: 0.4, flex: 1 },
    resultSection: { padding: 20, paddingHorizontal: 22, borderTopWidth: 1, borderTopColor: mc.border },
    productName:   { fontFamily: F.display, fontSize: 18, color: mc.text, marginBottom: 4, letterSpacing: 0.3 },
    brand:         { fontSize: 12, color: mc.text2, marginBottom: 16, fontFamily: F.mono, letterSpacing: 0.3 },
    macroGrid:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
    macroBox:      { flex: 1, backgroundColor: mc.elevated, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
    macroVal:      { fontFamily: F.display, fontSize: 17, color: accentColor, marginBottom: 4 },
    macroLbl:      { fontSize: 9, color: mc.text3, letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: F.mono },
    serving:       { fontSize: 12, color: mc.text2, marginBottom: 16, fontFamily: F.mono, letterSpacing: 0.3 },
    actions:       { flexDirection: 'row', gap: 10 },
    primaryBtn:    { flex: 1, paddingVertical: 11, backgroundColor: accentColor, alignItems: 'center' },
    primaryBtnTxt: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: '#060606', fontWeight: '700' },
    secondaryBtn:  { flex: 1, paddingVertical: 11, borderWidth: 1, borderColor: mc.border, alignItems: 'center' },
    secondaryBtnTxt:{ fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: mc.text2 },
    addedRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20, justifyContent: 'center' },
    addedTxt:    { fontSize: 13, color: '#4CAF7C', fontFamily: F.mono, letterSpacing: 0.5 },
    errorSection:{ padding: 18, paddingHorizontal: 22, borderTopWidth: 1, borderTopColor: mc.border },
    errorMsg:    { fontSize: 13, color: '#e57373', marginBottom: 12, fontFamily: F.mono, letterSpacing: 0.3 },
    manualLabel: { fontSize: 12, color: mc.text2, marginBottom: 6, fontFamily: F.mono },
    manualInput: { borderWidth: 1, borderColor: mc.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: mc.text, fontFamily: F.mono, outlineWidth: 0, marginBottom: 10 },
  });
}
