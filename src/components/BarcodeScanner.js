import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated, Easing,
} from 'react-native';
import Svg, { Path, Line, Circle, Polyline } from 'react-native-svg';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { lookupBarcode } from '../api';

// Matches the #barcodeModal design in perfect/index.html:
// centered overlay, one modal-box with camera + inline result + error

const CAM_H = 260;

export default function BarcodeScanner({ visible, onClose, onAdd }) {
  const { mc, accentColor } = useTheme();

  const videoRef    = useRef(null);
  const controlsRef = useRef(null);
  const fileInputRef = useRef(null);
  const scanLineY   = useRef(new Animated.Value(0)).current;
  const handledRef  = useRef(false);

  const [phase,       setPhase]      = useState('scanning');
  const [hint,        setHint]       = useState('Point camera at the barcode on any food package.');
  const [product,     setProduct]    = useState(null);
  const [errorMsg,    setErrorMsg]   = useState('');
  const [cameraFail,  setCameraFail] = useState(false);
  const [manualCode,  setManualCode] = useState('');
  const [imgLoading,  setImgLoading] = useState(false);
  const [restartKey,  setRestartKey] = useState(0);

  // Animated scan line (matches @keyframes scanSlide in the website)
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

  // Camera lifecycle
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

    async function start() {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true });
        probe.getTracks().forEach(t => t.stop());
        if (cancelled) return;

        const reader  = new BrowserMultiFormatReader();
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length === 0) {
          if (!cancelled) { setCameraFail(true); setPhase('error'); setErrorMsg('No camera found.'); }
          return;
        }
        const camera = devices.find(d => /back|environment|rear/i.test(d.label)) || devices[0];
        if (!cancelled) setHint('Auto-scanning… point camera at any barcode.');

        const controls = await reader.decodeFromVideoDevice(
          camera.deviceId,
          videoRef.current,
          async (result) => {
            if (result && !cancelled && !handledRef.current) {
              handledRef.current = true;
              controls.stop();
              controlsRef.current = null;
              await doLookup(result.getText());
            }
          }
        );
        if (cancelled) { controls.stop(); return; }
        controlsRef.current = controls;
      } catch (e) {
        if (cancelled) return;
        setCameraFail(true);
        setPhase('error');
        setErrorMsg(
          e?.name === 'NotAllowedError'
            ? 'Camera access blocked. Allow camera in system settings, then retry.'
            : 'Could not start camera.'
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      if (controlsRef.current) { controlsRef.current.stop(); controlsRef.current = null; }
    };
  }, [visible, restartKey]);

  async function doLookup(code) {
    if (controlsRef.current) { controlsRef.current.stop(); controlsRef.current = null; }
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

  async function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(url);
      if (result) {
        await doLookup(result.getText());
      } else {
        setPhase('error');
        setErrorMsg('No barcode found in that image.');
      }
    } catch {
      setPhase('error');
      setErrorMsg('No barcode found in that image.');
    } finally {
      URL.revokeObjectURL(url);
      setImgLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function lookupManual() {
    const code = manualCode.trim().replace(/\s/g, '');
    if (!code) return;
    await doLookup(code);
  }

  function doAdd() {
    if (product && onAdd) onAdd(product);
    setPhase('added');
  }

  function scanAnother() {
    if (controlsRef.current) { controlsRef.current.stop(); controlsRef.current = null; }
    handledRef.current = false;
    setRestartKey(k => k + 1);
  }

  const scanLineTop = scanLineY.interpolate({ inputRange: [0, 1], outputRange: ['20%', '78%'] });
  const showCam = phase === 'scanning' || phase === 'loading';

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
            <View style={s.headerRight}>
              <TouchableOpacity style={s.uploadBtn} onPress={() => fileInputRef.current?.click()} disabled={imgLoading}>
                {imgLoading ? (
                  <ActivityIndicator size="small" color={accentColor} />
                ) : (
                  <>
                    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth={2.5} strokeLinecap="round">
                      <Path d="M12 5v14M5 12h14" />
                    </Svg>
                    <Text style={s.uploadBtnTxt}>Upload image</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                <Text style={s.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Camera area */}
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
                <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.4} strokeLinecap="round">
                  <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <Circle cx="12" cy="13" r="4" />
                  <Line x1="1" y1="1" x2="23" y2="23" />
                </Svg>
              </View>
            )}
          </View>

          {/* Hint row */}
          {showCam && (
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
                <View style={s.macroBox}><Text style={s.macroVal}>{product.protein}g</Text><Text style={s.macroLbl}>protein</Text></View>
                <View style={s.macroBox}><Text style={s.macroVal}>{product.carbs}g</Text><Text style={s.macroLbl}>carbs</Text></View>
                <View style={s.macroBox}><Text style={s.macroVal}>{product.fat}g</Text><Text style={s.macroLbl}>fat</Text></View>
              </View>
              <Text style={s.serving}>Serving size: {product.serving} — values shown per 100g</Text>
              <View style={s.actions}>
                <TouchableOpacity style={s.primaryBtn} onPress={doAdd}><Text style={s.primaryBtnTxt}>Add to Food Log</Text></TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={scanAnother}><Text style={s.secondaryBtnTxt}>Scan another</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {/* Added */}
          {phase === 'added' && (
            <View style={s.resultSection}>
              <View style={s.addedRow}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#4CAF7C" strokeWidth={2.5} strokeLinecap="round">
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
              {cameraFail && (
                <>
                  <Text style={s.errorMsg}>Camera blocked or unavailable.</Text>
                  <Text style={[s.hintTxt, { marginBottom: 10 }]}>
                    Allow camera in system settings, then:
                  </Text>
                  <TouchableOpacity style={[s.secondaryBtn, { marginBottom: 14 }]} onPress={scanAnother}>
                    <Text style={s.secondaryBtnTxt}>Retry camera</Text>
                  </TouchableOpacity>
                </>
              )}
              {!cameraFail && <Text style={s.errorMsg}>{errorMsg}</Text>}
              <Text style={s.manualLabel}>Or enter barcode manually:</Text>
              <TextInput
                style={s.manualInput}
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="e.g. 5000159396914"
                placeholderTextColor={mc.text3}
                keyboardType="number-pad"
                onSubmitEditing={lookupManual}
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
    overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
    box:           { width: 480, maxWidth: '100%', backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.borderH },

    // Header
    header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: mc.border },
    headerTitle:   { fontFamily: F.display, fontSize: 17, color: mc.text, letterSpacing: 0.4 },
    headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    uploadBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: mc.border, paddingVertical: 4, paddingHorizontal: 10, minWidth: 40, justifyContent: 'center' },
    uploadBtnTxt:  { fontFamily: F.mono, fontSize: 10, color: mc.text2, letterSpacing: 0.5 },
    closeBtn:      { width: 28, height: 28, borderWidth: 1, borderColor: mc.border, alignItems: 'center', justifyContent: 'center' },
    closeTxt:      { color: mc.text2, fontSize: 16, lineHeight: 20 },

    // Camera
    camArea:       { width: '100%', height: CAM_H, backgroundColor: '#000', overflow: 'hidden', position: 'relative' },
    scanFrame:     { position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '20%', borderWidth: 1.5, borderColor: accentColor },
    scanLine:      { position: 'absolute', left: '20%', right: '20%', height: 1, backgroundColor: accentColor },
    camFailOverlay:{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },

    // Hint
    hintRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 12 },
    hintTxt:       { fontSize: 12, color: mc.text2, fontStyle: 'italic', fontFamily: F.mono, letterSpacing: 0.4, flex: 1 },

    // Result
    resultSection: { padding: 18, paddingHorizontal: 22, borderTopWidth: 1, borderTopColor: mc.border },
    productName:   { fontFamily: F.display, fontSize: 17, color: mc.text, marginBottom: 4 },
    brand:         { fontSize: 12, color: mc.text2, marginBottom: 14, fontFamily: F.mono },
    macroGrid:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
    macroBox:      { flex: 1, backgroundColor: mc.elevated, padding: 10, alignItems: 'center' },
    macroVal:      { fontFamily: F.display, fontSize: 16, color: accentColor },
    macroLbl:      { fontSize: 9, color: mc.text3, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 2, fontFamily: F.mono },
    serving:       { fontSize: 12, color: mc.text2, marginBottom: 14, fontFamily: F.mono },
    actions:       { flexDirection: 'row', gap: 10 },
    primaryBtn:    { flex: 1, padding: 10, backgroundColor: accentColor, alignItems: 'center' },
    primaryBtnTxt: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: '#060606', fontWeight: '700' },
    secondaryBtn:  { flex: 1, padding: 10, borderWidth: 1, borderColor: mc.border, alignItems: 'center' },
    secondaryBtnTxt:{ fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: mc.text2 },

    // Added
    addedRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18, justifyContent: 'center' },
    addedTxt:      { fontSize: 13, color: '#4CAF7C', fontFamily: F.mono, letterSpacing: 0.5 },

    // Error
    errorSection:  { padding: 18, paddingHorizontal: 22, borderTopWidth: 1, borderTopColor: mc.border },
    errorMsg:      { fontSize: 13, color: '#e57373', marginBottom: 10, fontFamily: F.mono },
    manualLabel:   { fontSize: 12, color: mc.text2, marginTop: 4, marginBottom: 6, fontFamily: F.mono },
    manualInput:   { borderWidth: 1, borderColor: mc.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: mc.text, fontFamily: F.mono, outlineWidth: 0, marginBottom: 10 },
  });
}
