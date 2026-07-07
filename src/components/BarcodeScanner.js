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
import { generalAiChat, lookupBarcode as offLookup } from '../api';

const CAM_H = 260;

const UNKNOWN_QUIPS = [
  "This barcode is apparently in witness protection.",
  "Scanned everywhere. Total mystery.",
  "404: product not found. It's living off the grid.",
  "Our database looked, shrugged, and went home.",
  "This one's a ghost — real barcode, zero footprint.",
  "Even the AI is confused. That's saying something.",
  "Unidentified edible object. Proceed with curiosity.",
  "Could be anything. Schrödinger's snack.",
];
function randomQuip() { return UNKNOWN_QUIPS[Math.floor(Math.random() * UNKNOWN_QUIPS.length)]; }

function makeReader() {
  const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
  return new BrowserMultiFormatReader(hints);
}

function parseAIJson(raw) {
  const cleaned = (raw || '').trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON');
  return JSON.parse(m[0]);
}

export default function BarcodeScanner({ visible, onClose, onAdd }) {
  const { mc, accentColor } = useTheme();

  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const intervalRef  = useRef(null);
  const fileInputRef = useRef(null);
  const scanLineY    = useRef(new Animated.Value(0)).current;
  const handledRef   = useRef(false);

  const [phase,      setPhase]      = useState('scanning');
  const [hint,       setHint]       = useState('Point camera at the barcode on any food package.');
  const [product,    setProduct]    = useState(null);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [cameraFail, setCameraFail] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [imgLoading, setImgLoading] = useState(false);
  const [capturing,  setCapturing]  = useState(false);
  const [frameColor, setFrameColor] = useState(accentColor);
  const [restartKey, setRestartKey] = useState(0);

  // Scan-line animation
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

  // Camera + scanning lifecycle
  useEffect(() => {
    if (!visible) return;

    setPhase('scanning');
    setHint('Point camera at the barcode on any food package.');
    setProduct(null);
    setErrorMsg('');
    setCameraFail(false);
    setManualCode('');
    setFrameColor(accentColor);
    handledRef.current = false;

    let cancelled = false;

    function stopAll() {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    }

    async function start() {
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

      setHint('Auto-scanning… hold the barcode steady in the frame.');

      const onDetected = async (code) => {
        if (handledRef.current || cancelled) return;
        handledRef.current = true;
        stopAll();
        setFrameColor('#4CAF7C');
        setTimeout(() => setFrameColor(accentColor), 800);
        await doLookup(code);
      };

      const cvs = document.createElement('canvas');
      const reader = makeReader();

      // Tier 1: Native BarcodeDetector (fastest — built into Chromium)
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'upc_e1', 'code_128', 'code_39', 'qr_code'],
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
        } catch {}
      }

      // Tier 2: ZXing decodeFromCanvas (bundled — no CDN needed)
      let decoding = false;
      intervalRef.current = setInterval(() => {
        if (handledRef.current || cancelled || decoding) return;
        if (!video.readyState || video.readyState < 2) return;
        cvs.width  = video.videoWidth  || 640;
        cvs.height = video.videoHeight || 480;
        cvs.getContext('2d').drawImage(video, 0, 0);
        decoding = true;
        try {
          const result = reader.decodeFromCanvas(cvs);
          if (result) onDetected(result.getText());
        } catch {}
        decoding = false;
      }, 300);
    }

    start();
    return () => {
      cancelled = true;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    };
  }, [visible, restartKey]);

  // Open Food Facts → AI fallback
  async function doLookup(code) {
    setPhase('loading');
    setHint('Found barcode ' + code + ' — looking up product…');
    try {
      const p = await offLookup(code);
      if (p?.name) { setProduct(p); setPhase('result'); return; }
    } catch {}
    // Not found in OFF — ask AI by barcode number
    setHint('Not in database, asking AI…');
    try {
      const data = await generalAiChat([{
        role: 'user',
        content: `The barcode number is ${code}. Do you recognise this food product? If yes, respond ONLY with valid JSON:\n{"name":"<product name>","brand":"<brand>","calories":<kcal per 100g>,"protein":<g>,"carbs":<g>,"fat":<g>,"serving":"100g"}\nIf you do not recognise this barcode at all, respond ONLY with: {"unknown":true}`,
      }]);
      const parsed = parseAIJson(data.reply || '');
      if (parsed.unknown) { setPhase('error'); setErrorMsg(randomQuip()); return; }
      setProduct({
        name:     parsed.name     || 'Product ' + code,
        brand:    parsed.brand    || '',
        calories: parsed.calories || 0,
        protein:  parsed.protein  || 0,
        carbs:    parsed.carbs    || 0,
        fat:      parsed.fat      || 0,
        serving:  parsed.serving  || '100g',
      });
      setPhase('result');
    } catch {
      setPhase('error');
      setErrorMsg('Could not identify this product. Try entering the barcode manually.');
    }
  }

  // AI analyses a base64 image — identifies barcode, food, or meal
  async function analyseBase64Image(base64) {
    setPhase('loading');
    setHint('AI is analysing the image…');
    try {
      const data = await generalAiChat([{
        role: 'user',
        content: 'Look at this image carefully. First decide: does it show a barcode, a packaged food product, or a meal?\n\nIf it is none of these (just a random object, person, scenery, text, etc.) respond ONLY with: {"not_food":true}\n\nOtherwise respond ONLY with valid JSON — no extra text, no markdown:\n{"barcode":"<barcode number or empty string>","name":"<product or food name>","brand":"<brand or empty>","calories":<kcal per 100g or for the portion>,"protein":<g>,"carbs":<g>,"fat":<g>,"serving":"<serving size or 100g>"}',
        images: [base64],
      }]);
      const parsed = parseAIJson(data.reply || '');

      if (parsed.not_food) {
        setPhase('error');
        setErrorMsg("That doesn't look like a barcode or food. Try a clearer photo of a product or meal.");
        return;
      }

      // AI found a barcode — try Open Food Facts first for verified data
      if (parsed.barcode && parsed.barcode.length > 6) {
        setHint('Found barcode ' + parsed.barcode + ' — verifying with database…');
        try {
          const off = await offLookup(parsed.barcode);
          if (off?.name) { setProduct(off); setPhase('result'); return; }
        } catch {}
      }

      // Use AI's own nutritional data
      setProduct({
        name:     parsed.name     || 'Unknown product',
        brand:    parsed.brand    || '',
        calories: parsed.calories || 0,
        protein:  parsed.protein  || 0,
        carbs:    parsed.carbs    || 0,
        fat:      parsed.fat      || 0,
        serving:  parsed.serving  || '100g',
      });
      setPhase('result');
    } catch {
      setPhase('error');
      setErrorMsg('Could not analyse the image. Try a clearer photo with good lighting.');
    }
  }

  // Capture current frame and send to AI
  async function captureAndAnalyse() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) { setHint('Camera not ready — try again.'); return; }
    setCapturing(true);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    handledRef.current = true;
    try {
      const cvs = document.createElement('canvas');
      cvs.width  = video.videoWidth  || 640;
      cvs.height = video.videoHeight || 480;
      cvs.getContext('2d').drawImage(video, 0, 0);
      await analyseBase64Image(cvs.toDataURL('image/jpeg', 0.85));
    } catch {
      setHint('Could not capture frame — try again.');
      handledRef.current = false;
    } finally {
      setCapturing(false);
    }
  }

  // Upload image → FileReader → base64 → AI
  async function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    handledRef.current = true;
    setImgLoading(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try { await analyseBase64Image(ev.target.result); }
      finally { setImgLoading(false); }
    };
    reader.onerror = () => setImgLoading(false);
    reader.readAsDataURL(file);
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

          {/* Camera view */}
          <View style={s.camArea}>
            {React.createElement('video', {
              ref: videoRef, autoPlay: true, playsInline: true, muted: true,
              style: { width: '100%', height: '100%', objectFit: 'cover', display: cameraFail ? 'none' : 'block' },
            })}
            {!cameraFail && (
              <>
                <View style={[s.scanFrame, { borderColor: frameColor }]} />
                <Animated.View style={[s.scanLine, { top: scanLineTop, backgroundColor: frameColor }]} />
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

          {/* Controls — upload + capture, always shown while scanning */}
          {phase === 'scanning' && (
            <View style={s.controlsRow}>
              <TouchableOpacity style={s.photoBtn} onPress={() => fileInputRef.current?.click()} disabled={imgLoading}>
                {imgLoading ? <ActivityIndicator size="small" color={accentColor} /> : (
                  <>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth={2.5} strokeLinecap="round">
                      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </Svg>
                    <Text style={s.photoBtnTxt}>Upload photo</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.captureBtn, (capturing || cameraFail) && s.captureBtnDisabled]}
                onPress={captureAndAnalyse}
                disabled={capturing || cameraFail}
              >
                {capturing ? <ActivityIndicator size="small" color="#060606" /> : (
                  <>
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#060606" strokeWidth={2.2} strokeLinecap="round">
                      <Circle cx="12" cy="12" r="10" /><Circle cx="12" cy="12" r="4" />
                    </Svg>
                    <Text style={s.captureBtnTxt}>Capture & Analyse</Text>
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
              {!!product.brand && <Text style={s.brand}>{product.brand}</Text>}
              <View style={s.macroGrid}>
                <View style={s.macroBox}>
                  <Text style={s.macroVal}>{product.calories}</Text>
                  <Text style={s.macroLbl}>kcal</Text>
                </View>
                <View style={s.macroBox}>
                  <Text style={s.macroVal}>{product.protein}g</Text>
                  <Text style={s.macroLbl}>Protein</Text>
                </View>
                <View style={s.macroBox}>
                  <Text style={s.macroVal}>{product.carbs}g</Text>
                  <Text style={s.macroLbl}>Carbs</Text>
                </View>
                <View style={s.macroBox}>
                  <Text style={s.macroVal}>{product.fat}g</Text>
                  <Text style={s.macroLbl}>Fat</Text>
                </View>
              </View>
              <Text style={s.serving}>Per {product.serving || '100g'} · values shown per 100g</Text>
              <View style={s.actions}>
                <TouchableOpacity style={s.primaryBtn} onPress={doAdd}>
                  <Text style={s.primaryBtnTxt}>Add to Today's Log</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={scanAnother}>
                  <Text style={s.secondaryBtnTxt}>Scan another</Text>
                </TouchableOpacity>
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
                <TouchableOpacity style={s.primaryBtn} onPress={scanAnother}>
                  <Text style={s.primaryBtnTxt}>Scan another</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={onClose}>
                  <Text style={s.secondaryBtnTxt}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Error */}
          {phase === 'error' && (
            <View style={s.errorSection}>
              <Text style={s.errorMsg}>{errorMsg}</Text>
              <View style={s.errorActions}>
                <TouchableOpacity style={s.photoBtn} onPress={() => fileInputRef.current?.click()} disabled={imgLoading}>
                  {imgLoading ? <ActivityIndicator size="small" color={accentColor} /> : (
                    <>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth={2.5} strokeLinecap="round">
                        <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </Svg>
                      <Text style={s.photoBtnTxt}>Upload a photo</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={scanAnother}>
                  <Text style={s.secondaryBtnTxt}>{cameraFail ? 'Retry camera' : 'Try again'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.manualLabel}>Or enter barcode number manually:</Text>
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
    overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 20 },
    box:         { width: 480, maxWidth: '100%', backgroundColor: mc.surface, borderWidth: 1, borderColor: mc.borderH },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: mc.border },
    headerTitle: { fontFamily: F.display, fontSize: 17, color: mc.text, letterSpacing: 0.4 },
    closeBtn:    { width: 28, height: 28, borderWidth: 1, borderColor: mc.border, alignItems: 'center', justifyContent: 'center' },
    closeTxt:    { color: mc.text2, fontSize: 16, lineHeight: 20 },
    camArea:       { width: '100%', height: CAM_H, backgroundColor: '#000', overflow: 'hidden', position: 'relative' },
    scanFrame:     { position: 'absolute', top: '18%', left: '15%', right: '15%', bottom: '18%', borderWidth: 2 },
    scanLine:      { position: 'absolute', left: '15%', right: '15%', height: 1.5 },
    camFailOverlay:{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', gap: 10 },
    camFailTxt:    { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: F.mono, letterSpacing: 0.5 },
    controlsRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: mc.border, gap: 10 },
    photoBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: mc.border, paddingVertical: 8, paddingHorizontal: 14 },
    photoBtnTxt:  { fontFamily: F.mono, fontSize: 11, color: mc.text2, letterSpacing: 0.5 },
    captureBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: accentColor, paddingVertical: 8, paddingHorizontal: 16 },
    captureBtnDisabled: { opacity: 0.5 },
    captureBtnTxt: { fontFamily: F.mono, fontSize: 11, color: '#060606', fontWeight: '700', letterSpacing: 0.8 },
    hintRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 12 },
    hintTxt:     { fontSize: 12, color: mc.text2, fontStyle: 'italic', fontFamily: F.mono, letterSpacing: 0.4, flex: 1 },
    resultSection: { padding: 20, paddingHorizontal: 22 },
    productName:   { fontFamily: F.display, fontSize: 19, color: mc.text, marginBottom: 3, letterSpacing: 0.3 },
    brand:         { fontSize: 12, color: mc.text2, marginBottom: 16, fontFamily: F.mono, letterSpacing: 0.4 },
    macroGrid:     { flexDirection: 'row', gap: 8, marginBottom: 14, marginTop: 14 },
    macroBox:      { flex: 1, backgroundColor: mc.elevated, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', borderWidth: 1, borderColor: mc.border },
    macroVal:      { fontFamily: F.display, fontSize: 18, color: accentColor, marginBottom: 5 },
    macroLbl:      { fontSize: 9, color: mc.text3, letterSpacing: 1.6, textTransform: 'uppercase', fontFamily: F.mono },
    serving:       { fontSize: 11, color: mc.text3, marginBottom: 18, fontFamily: F.mono, letterSpacing: 0.3 },
    actions:       { flexDirection: 'row', gap: 10 },
    primaryBtn:    { flex: 1, paddingVertical: 12, backgroundColor: accentColor, alignItems: 'center' },
    primaryBtnTxt: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: '#060606', fontWeight: '700' },
    secondaryBtn:  { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: mc.border, alignItems: 'center' },
    secondaryBtnTxt:{ fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: mc.text2 },
    addedRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 22, justifyContent: 'center' },
    addedTxt:    { fontSize: 14, color: '#4CAF7C', fontFamily: F.mono, letterSpacing: 0.5 },
    errorSection:{ padding: 18, paddingHorizontal: 22 },
    errorMsg:    { fontSize: 13, color: '#e57373', marginBottom: 14, fontFamily: F.mono, letterSpacing: 0.3, lineHeight: 20 },
    errorActions:{ flexDirection: 'row', gap: 10, marginBottom: 18 },
    manualLabel: { fontSize: 12, color: mc.text2, marginBottom: 6, fontFamily: F.mono },
    manualInput: { borderWidth: 1, borderColor: mc.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: mc.text, fontFamily: F.mono, outlineWidth: 0, marginBottom: 10 },
  });
}
