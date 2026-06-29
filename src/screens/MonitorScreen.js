import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import Svg, { Path, Polyline, Line } from 'react-native-svg';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { monitorAnalyze, monitorExtract, monitorSave, monitorHistory } from '../api';
import { getToken, getUser } from '../auth';

// ── Blood test categories (from HTML Jinja template) ──────────────────────────
const CATEGORIES = [
  {
    id: 'cbc',
    label: 'Complete Blood Count (CBC)',
    fields: [
      { id: 'hemoglobin',   label: 'Hemoglobin',   unit: 'g/dL',          hint: 'M:13.5–17.5 / F:12–15.5' },
      { id: 'wbc',          label: 'WBC',           unit: '×10³/μL',       hint: '4.5–11.0' },
      { id: 'rbc',          label: 'RBC',           unit: 'M/μL',          hint: 'M:4.5–5.9 / F:4.1–5.1' },
      { id: 'platelets',    label: 'Platelets',     unit: '×10³/μL',       hint: '150–400' },
      { id: 'hematocrit',   label: 'Hematocrit',   unit: '%',             hint: 'M:41–53 / F:36–46' },
      { id: 'mcv',          label: 'MCV',           unit: 'fL',            hint: '80–100' },
      { id: 'mch',          label: 'MCH',           unit: 'pg',            hint: '27–33' },
    ],
  },
  {
    id: 'lipid',
    label: 'Lipid Panel',
    fields: [
      { id: 'total_cholesterol', label: 'Total Cholesterol', unit: 'mg/dL', hint: '<200' },
      { id: 'ldl',               label: 'LDL',               unit: 'mg/dL', hint: '<100 optimal' },
      { id: 'hdl',               label: 'HDL',               unit: 'mg/dL', hint: 'M:>40 / F:>50' },
      { id: 'triglycerides',     label: 'Triglycerides',     unit: 'mg/dL', hint: '<150' },
    ],
  },
  {
    id: 'glucose',
    label: 'Blood Glucose',
    fields: [
      { id: 'fasting_glucose', label: 'Fasting Glucose',    unit: 'mg/dL', hint: '70–100' },
      { id: 'hba1c',           label: 'HbA1c',              unit: '%',     hint: '<5.7% normal' },
      { id: 'postprandial',    label: 'Postprandial (2h)',  unit: 'mg/dL', hint: '<140' },
    ],
  },
  {
    id: 'liver',
    label: 'Liver Function',
    fields: [
      { id: 'alt',              label: 'ALT',              unit: 'U/L',   hint: '7–56' },
      { id: 'ast',              label: 'AST',              unit: 'U/L',   hint: '10–40' },
      { id: 'bilirubin_total',  label: 'Total Bilirubin',  unit: 'mg/dL', hint: '0.1–1.2' },
      { id: 'albumin',          label: 'Albumin',          unit: 'g/dL',  hint: '3.5–5.0' },
      { id: 'alp',              label: 'ALP',              unit: 'U/L',   hint: '44–147' },
      { id: 'ggt',              label: 'GGT',              unit: 'U/L',   hint: 'M:8–61 / F:5–36' },
    ],
  },
  {
    id: 'kidney',
    label: 'Kidney Function',
    fields: [
      { id: 'creatinine', label: 'Creatinine', unit: 'mg/dL',        hint: 'M:0.7–1.3 / F:0.6–1.1' },
      { id: 'bun',        label: 'BUN',        unit: 'mg/dL',        hint: '7–20' },
      { id: 'egfr',       label: 'eGFR',       unit: 'mL/min/1.73m²', hint: '>60' },
      { id: 'uric_acid',  label: 'Uric Acid',  unit: 'mg/dL',        hint: 'M:3.4–7.0 / F:2.4–6.0' },
    ],
  },
  {
    id: 'thyroid',
    label: 'Thyroid',
    fields: [
      { id: 'tsh',     label: 'TSH',      unit: 'mIU/L', hint: '0.4–4.0' },
      { id: 'free_t4', label: 'Free T4',  unit: 'ng/dL', hint: '0.8–1.8' },
      { id: 'free_t3', label: 'Free T3',  unit: 'pg/mL', hint: '2.3–4.2' },
    ],
  },
  {
    id: 'vitamins',
    label: 'Vitamins & Minerals',
    fields: [
      { id: 'vitamin_d',   label: 'Vitamin D',   unit: 'ng/mL',  hint: '30–100 (<20=deficient)' },
      { id: 'vitamin_b12', label: 'Vitamin B12', unit: 'pg/mL',  hint: '200–900' },
      { id: 'iron',        label: 'Iron',        unit: 'μg/dL',  hint: 'M:65–175 / F:50–170' },
      { id: 'ferritin',    label: 'Ferritin',    unit: 'ng/mL',  hint: 'M:24–336 / F:11–307' },
      { id: 'folate',      label: 'Folate',      unit: 'ng/mL',  hint: '2.7–17.0' },
      { id: 'calcium',     label: 'Calcium',     unit: 'mg/dL',  hint: '8.5–10.2' },
      { id: 'magnesium',   label: 'Magnesium',   unit: 'mg/dL',  hint: '1.7–2.2' },
      { id: 'potassium',   label: 'Potassium',   unit: 'mEq/L',  hint: '3.5–5.0' },
      { id: 'sodium',      label: 'Sodium',      unit: 'mEq/L',  hint: '136–145' },
    ],
  },
  {
    id: 'inflam',
    label: 'Inflammation',
    fields: [
      { id: 'crp', label: 'CRP', unit: 'mg/L',   hint: '<1.0 optimal' },
      { id: 'esr', label: 'ESR', unit: 'mm/hr',  hint: 'M:0–15 / F:0–20' },
    ],
  },
];

// ── Colour helpers ─────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  Normal:           '#52A87C',
  'Attention Needed': '#E09A2A',
  Concerning:       '#E07A2A',
  Critical:         '#E05252',
};
const FLAG_BORDER = {
  normal:     '#52A87C',
  borderline: '#E09A2A',
  low:        '#4A9EFF',
  high:       '#E05252',
};
const FLAG_CHIP_BG = {
  normal:     'rgba(82,168,124,0.12)',
  borderline: 'rgba(224,154,42,0.12)',
  low:        'rgba(74,158,255,0.12)',
  high:       'rgba(224,82,82,0.12)',
};
const FLAG_CHIP_COLOR = {
  normal:     '#52A87C',
  borderline: '#E09A2A',
  low:        '#4A9EFF',
  high:       '#E05252',
};

function overallColor(status) {
  return STATUS_COLORS[status] || '#8A7A62';
}
function flagBorder(status, borderFallback) {
  return FLAG_BORDER[(status || '').toLowerCase()] || borderFallback;
}
function flagChipBg(status) {
  return FLAG_CHIP_BG[(status || '').toLowerCase()] || 'rgba(138,122,98,0.1)';
}
function flagChipColor(status, text2Fallback) {
  return FLAG_CHIP_COLOR[(status || '').toLowerCase()] || text2Fallback;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MonitorScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();

  // Who is this for
  const [forMyself, setForMyself] = useState(true);
  const [otherGender, setOtherGender] = useState('');
  const [otherAge, setOtherAge] = useState('');
  const [profileUser, setProfileUser] = useState(null);

  // Tabs
  const [activeTab, setActiveTab] = useState('upload');

  // Upload / image
  const [imageB64, setImageB64] = useState(null);
  const [imageMime, setImageMime] = useState(null);
  const [imageUri, setImageUri] = useState(null);

  // Extract banner
  const [bannerMsg, setBannerMsg] = useState('');
  const [bannerSuccess, setBannerSuccess] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);

  // Manual field values — keyed by field id
  const [values, setValues] = useState({});
  // Which categories are expanded
  const [expanded, setExpanded] = useState({});

  // Analyze
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Analyzing...');

  // Results
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);

  // History
  const [history, setHistory] = useState([]);
  const [histExpanded, setHistExpanded] = useState({});

  const resultsRef = useRef(null);

  useEffect(() => {
    // load profile for "myself" badge
    getUser().then(u => setProfileUser(u)).catch(() => {});
    loadHistory();
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function showBanner(msg, success) {
    setBannerMsg(msg);
    setBannerSuccess(success);
    setBannerVisible(true);
  }
  function hideBanner() {
    setBannerVisible(false);
  }

  function getGender() {
    return forMyself
      ? (profileUser?.gender || '')
      : otherGender;
  }
  function getAge() {
    return forMyself
      ? (profileUser?.age || '')
      : otherAge;
  }

  function switchTab(tab) {
    setActiveTab(tab);
  }

  function toggleCat(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function setVal(id, v) {
    setValues(prev => ({ ...prev, [id]: v }));
  }

  // ── File pick (web) ────────────────────────────────────────────────────────
  function pickFile() {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      let inp = document.getElementById('_monitorFileInput');
      if (!inp) {
        inp = document.createElement('input');
        inp.id = '_monitorFileInput';
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.style.display = 'none';
        document.body.appendChild(inp);
      }
      inp.onchange = (e) => {
        const file = e.target.files[0];
        if (file) loadFile(file);
        inp.value = '';
      };
      inp.click();
    }
  }

  function loadFile(file) {
    const mime = file.type || 'image/jpeg';
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const b64 = dataUrl.split(',')[1];
      setImageB64(b64);
      setImageMime(mime);
      setImageUri(dataUrl);
      extractValues(b64, mime);
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImageB64(null);
    setImageMime(null);
    setImageUri(null);
    hideBanner();
  }

  // ── Extract values from image ──────────────────────────────────────────────
  async function extractValues(b64, mime) {
    showBanner('Reading your report...', false);
    setLoading(true);
    setLoadingText('Reading report image...');
    try {
      const data = await monitorExtract({ image_b64: b64, image_mime: mime });
      if (!data.ok || !data.values) throw new Error(data.error || 'No values found');

      let count = 0;
      const newValues = {};
      Object.entries(data.values).forEach(([fid, val]) => {
        if (val) { newValues[fid] = String(val); count++; }
      });

      if (count === 0) throw new Error('No recognisable blood values found in the image');

      setValues(prev => ({ ...prev, ...newValues }));

      // Auto-expand categories that have filled fields
      const newExpanded = {};
      CATEGORIES.forEach(cat => {
        const hasFilled = cat.fields.some(f => newValues[f.id]);
        if (hasFilled) newExpanded[cat.id] = true;
      });
      setExpanded(prev => ({ ...prev, ...newExpanded }));

      showBanner(`${count} value${count !== 1 ? 's' : ''} extracted. Review below and click Analyze.`, true);
      switchTab('manual');
    } catch (err) {
      showBanner(
        'Could not read values automatically — ' + err.message + '. Enter them manually below.',
        false,
      );
      switchTab('manual');
    } finally {
      setLoading(false);
    }
  }

  // ── Analyze ────────────────────────────────────────────────────────────────
  async function analyze() {
    const isUpload = activeTab === 'upload';
    let payload = { gender: getGender(), age: getAge() };

    if (isUpload && imageB64) {
      payload.image_b64 = imageB64;
      payload.image_mime = imageMime;
    } else {
      // manual values: collect non-empty, keyed by "Label (unit)"
      const manualVals = {};
      CATEGORIES.forEach(cat => {
        cat.fields.forEach(f => {
          const v = (values[f.id] || '').trim();
          if (v) manualVals[`${f.label} (${f.unit})`] = v;
        });
      });
      if (!Object.keys(manualVals).length) {
        showBanner('Please enter at least one blood test value.', false);
        return;
      }
      payload.values = manualVals;
    }

    setLoading(true);
    setLoadingText('Analyzing...');
    setResult(null);
    setSaved(false);

    try {
      const data = await monitorAnalyze(payload);
      if (!data.ok) throw new Error(data.error || 'AI error');
      setResult(data.result);

      // Auto-save if for myself
      if (forMyself && data.result?.flags) {
        const label = new Date().toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        });
        try {
          await monitorSave({ report: data.result, label });
          setSaved(true);
          loadHistory();
        } catch {}
      }
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  // ── History ────────────────────────────────────────────────────────────────
  async function loadHistory() {
    try {
      const data = await monitorHistory();
      if (data?.ok) setHistory(data.history || []);
    } catch {}
  }

  function toggleHistRow(id) {
    setHistExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const st = StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: mc.bg,
    },
    scrollContent: {
      paddingBottom: 60,
    },

    // Header — .mon-header
    header: {
      paddingHorizontal: 40,
      paddingTop: 28,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flexShrink: 0,
    },
    headerIcon: {
      width: 36,
      height: 36,
      backgroundColor: mc.goldDim,
      borderWidth: 1,
      borderColor: mc.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    pageTitle: {
      fontFamily: F.display,
      fontSize: 22,
      color: mc.text,
      fontWeight: '400',
    },
    pageSub: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 0.14 * 10,
      marginTop: 2,
      textTransform: 'uppercase',
    },

    // Who strip — .who-strip
    whoStrip: {
      marginTop: 20,
      marginHorizontal: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    },
    whoLabel: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 1,
    },
    whoBtn: {
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: mc.border,
      backgroundColor: 'transparent',
    },
    whoBtnActive: {
      backgroundColor: mc.goldDim,
      borderColor: accentColor,
    },
    whoBtnTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      letterSpacing: 0.6,
      color: mc.text2,
    },
    profileBadge: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: mc.border,
      backgroundColor: mc.surface,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    profileBadgeTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text2,
    },
    otherFields: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    whoField: {
      flexDirection: 'column',
      gap: 4,
    },
    whoFieldLabel: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 0.8,
    },
    whoSelect: {
      flexDirection: 'row',
      gap: 4,
    },
    whoSelectOpt: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: mc.border,
      backgroundColor: mc.surface,
    },
    whoSelectOptActive: {
      borderColor: mc.borderH,
      backgroundColor: mc.elevated,
    },
    whoSelectOptTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text2,
    },
    whoInput: {
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
      color: mc.text,
      fontFamily: F.mono,
      fontSize: fontSize,
      paddingVertical: 6,
      paddingHorizontal: 10,
      width: 140,
      outlineWidth: 0,
    },

    // Tabs — .mon-tabs
    tabsRow: {
      flexDirection: 'row',
      marginTop: 20,
      marginHorizontal: 40,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    tab: {
      paddingVertical: 9,
      paddingHorizontal: 20,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -1,
    },
    tabActive: {
      borderBottomColor: accentColor,
    },
    tabTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      letterSpacing: 0.8,
      color: mc.text3,
    },

    // Body — .mon-body
    body: {
      paddingHorizontal: 40,
      paddingTop: 20,
      paddingBottom: 40,
      flexDirection: 'column',
      gap: 18,
    },

    // Upload zone — .upload-zone
    uploadZone: {
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: mc.border,
      paddingVertical: 40,
      paddingHorizontal: 24,
      alignItems: 'center',
      cursor: 'pointer',
    },
    uploadTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text2,
      marginTop: 10,
      textAlign: 'center',
    },
    uploadSub: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      marginTop: 4,
      textAlign: 'center',
    },

    // Image preview
    imgPreviewWrap: {
      position: 'relative',
    },
    imgPreview: {
      width: '100%',
      height: 300,
      borderWidth: 1,
      borderColor: mc.border,
    },
    imgClear: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.75)',
      borderWidth: 1,
      borderColor: mc.border,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    imgClearTxt: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text2,
    },

    // Extract banner — .extract-banner
    extractBanner: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      marginTop: 8,
    },
    extractBannerTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      lineHeight: 18,
    },

    // Category blocks — .cat-block
    catBlock: {
      borderWidth: 1,
      borderColor: mc.border,
      marginBottom: 0,
    },
    catHead: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: mc.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    catHeadTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      letterSpacing: 1,
      color: mc.text2,
      textTransform: 'uppercase',
    },
    catChevron: {
      fontFamily: F.mono,
      fontSize: 13,
      color: mc.text3,
    },
    catBody: {
      padding: 16,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },

    // Field wrap — .field-wrap
    fieldWrap: {
      flexDirection: 'column',
      gap: 4,
      minWidth: 190,
      flex: 1,
    },
    fieldLabel: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 0.6,
    },
    fieldUnit: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
    },
    fieldHint: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
      opacity: 0.6,
    },
    fieldInput: {
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
      color: mc.text,
      fontFamily: F.mono,
      fontSize: fontSize,
      paddingVertical: 7,
      paddingHorizontal: 10,
      outlineWidth: 0,
    },
    fieldInputFilled: {
      borderColor: 'rgba(82,168,124,0.5)',
      backgroundColor: 'rgba(82,168,124,0.04)',
    },

    // Analyze button row
    analyzeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
      marginTop: 4,
    },
    analyzeBtn: {
      paddingVertical: 11,
      paddingHorizontal: 28,
      backgroundColor: accentColor,
      cursor: 'pointer',
    },
    analyzeTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      fontWeight: '700',
      letterSpacing: 1,
      color: '#0A0A0A',
      textTransform: 'uppercase',
    },
    loadingRing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    loadingTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text3,
    },

    // Results container
    results: {
      flexDirection: 'column',
      gap: 22,
    },

    // Overall card — .overall-card
    overallCard: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: mc.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    overallDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      flexShrink: 0,
    },
    overallStatus: {
      fontFamily: F.serif,
      fontSize: 18,
      fontWeight: '400',
    },
    overallAssess: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text2,
      lineHeight: 20,
      marginTop: 4,
    },

    // Res label — .res-label
    resLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    resLabelTxt: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    resLabelLine: {
      flex: 1,
      height: 1,
      backgroundColor: mc.border,
    },

    // Flags grid — .flags-grid
    flagsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },

    // Flag card — .flag-card
    flagCard: {
      borderWidth: 1,
      borderColor: mc.border,
      borderLeftWidth: 3,
      padding: 12,
      paddingHorizontal: 14,
      minWidth: 210,
      flex: 1,
    },
    flagTest: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      letterSpacing: 0.6,
    },
    flagValue: {
      fontFamily: F.serif,
      fontSize: 17,
      color: mc.text,
      marginVertical: 3,
      fontWeight: '400',
    },
    flagChip: {
      alignSelf: 'flex-start',
      paddingVertical: 2,
      paddingHorizontal: 7,
      marginBottom: 2,
    },
    flagChipTxt: {
      fontFamily: F.mono,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontWeight: '700',
    },
    flagSev: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    flagRange: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
      marginTop: 3,
    },
    flagImpact: {
      fontFamily: F.mono,
      fontSize: Math.max(10, fontSize - 2),
      color: mc.text2,
      lineHeight: 16,
      marginTop: 6,
    },

    // Warnings list — .warnings-list li
    warnItem: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: 'rgba(224,82,82,0.25)',
      backgroundColor: 'rgba(224,82,82,0.06)',
      marginBottom: 6,
    },
    warnTxt: {
      fontFamily: F.mono,
      fontSize: 12.5,
      color: '#E05252',
      lineHeight: 20,
    },

    // Caution note — .caution-note
    cautionNote: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
    },
    cautionTxt: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      lineHeight: 18,
    },

    // Saved badge — .saved-badge
    savedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: 'rgba(82,168,124,0.3)',
      backgroundColor: 'rgba(82,168,124,0.07)',
    },
    savedBadgeTxt: {
      fontFamily: F.mono,
      fontSize: 11,
      color: '#52A87C',
    },

    // History section
    historySection: {
      flexDirection: 'column',
      gap: 12,
      marginTop: 12,
    },
    histTableHeader: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    histTh: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
      fontWeight: '400',
      letterSpacing: 0.8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      textTransform: 'none',
    },
    histEmptyRow: {
      paddingVertical: 20,
      paddingHorizontal: 12,
      alignItems: 'center',
    },
    histEmptyTxt: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text3,
      textAlign: 'center',
    },
    histRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
      alignItems: 'flex-start',
    },
    histTd: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text2,
      paddingVertical: 10,
      paddingHorizontal: 12,
      lineHeight: 16,
    },
    histExpandRow: {
      paddingHorizontal: 12,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={st.screen} contentContainerStyle={st.scrollContent}>

      {/* ── Header ── */}
      <View style={st.header}>
        <View style={st.headerIcon}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
            stroke={accentColor} strokeWidth="1.8" strokeLinecap="round">
            <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </Svg>
        </View>
        <View>
          <Text style={st.pageTitle}>Blood Monitor</Text>
          <Text style={st.pageSub}>Upload a report or enter values — get a health assessment</Text>
        </View>
      </View>

      {/* ── Who strip ── */}
      <View style={st.whoStrip}>
        <Text style={st.whoLabel}>This report is for:</Text>
        <TouchableOpacity
          style={[st.whoBtn, forMyself && st.whoBtnActive]}
          onPress={() => setForMyself(true)}>
          <Text style={[st.whoBtnTxt, forMyself && { color: accentColor }]}>Myself</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.whoBtn, !forMyself && st.whoBtnActive]}
          onPress={() => setForMyself(false)}>
          <Text style={[st.whoBtnTxt, !forMyself && { color: accentColor }]}>Someone else</Text>
        </TouchableOpacity>

        {/* Myself badge */}
        {forMyself && (
          <View style={st.profileBadge}>
            <Text style={st.profileBadgeTxt}>
              {profileUser?.gender
                ? profileUser.gender.charAt(0).toUpperCase() + profileUser.gender.slice(1)
                : 'Gender not set'}
              {', Age '}
              {profileUser?.age || 'not set'}
              {'  '}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('settings')}>
              <Text style={[st.profileBadgeTxt, { color: accentColor }]}>Update in settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Other fields */}
        {!forMyself && (
          <View style={st.otherFields}>
            <View style={st.whoField}>
              <Text style={st.whoFieldLabel}>Gender</Text>
              <View style={st.whoSelect}>
                {['', 'male', 'female'].map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[st.whoSelectOpt, otherGender === opt && st.whoSelectOptActive]}
                    onPress={() => setOtherGender(opt)}>
                    <Text style={[st.whoSelectOptTxt, otherGender === opt && { color: mc.text }]}>
                      {opt === '' ? 'Unspecified' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={st.whoField}>
              <Text style={st.whoFieldLabel}>Age</Text>
              <TextInput
                style={st.whoInput}
                value={otherAge}
                onChangeText={setOtherAge}
                placeholder="e.g. 28"
                placeholderTextColor={mc.text3}
                keyboardType="numeric"
              />
            </View>
          </View>
        )}
      </View>

      {/* ── Tabs ── */}
      <View style={st.tabsRow}>
        <TouchableOpacity
          style={[st.tab, activeTab === 'upload' && st.tabActive]}
          onPress={() => switchTab('upload')}>
          <Text style={[st.tabTxt, activeTab === 'upload' && { color: accentColor }]}>Upload Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.tab, activeTab === 'manual' && st.tabActive]}
          onPress={() => switchTab('manual')}>
          <Text style={[st.tabTxt, activeTab === 'manual' && { color: accentColor }]}>Enter Values</Text>
        </TouchableOpacity>
      </View>

      {/* ── Body ── */}
      <View style={st.body}>

        {/* ── Upload tab ── */}
        {activeTab === 'upload' && (
          <View>
            {!imageUri ? (
              <TouchableOpacity
                style={st.uploadZone}
                onPress={pickFile}
                activeOpacity={0.8}>
                <Svg width={32} height={32} viewBox="0 0 24 24" fill="none"
                  stroke={mc.text3} strokeWidth="1.5" strokeLinecap="round">
                  <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <Polyline points="17 8 12 3 7 8" />
                  <Line x1="12" y1="3" x2="12" y2="15" />
                </Svg>
                <Text style={st.uploadTxt}>Tap to upload your blood report</Text>
                <Text style={st.uploadSub}>JPG, PNG — AI reads the values and fills them in automatically</Text>
              </TouchableOpacity>
            ) : (
              <View style={st.imgPreviewWrap}>
                {Platform.OS === 'web' ? (
                  // eslint-disable-next-line react-native/no-inline-styles
                  <img
                    src={imageUri}
                    alt="Report preview"
                    style={{ maxWidth: '100%', maxHeight: 300, border: `1px solid ${mc.border}`, display: 'block' }}
                  />
                ) : (
                  <Image
                    source={{ uri: imageUri }}
                    style={st.imgPreview}
                    resizeMode="contain"
                  />
                )}
                <TouchableOpacity style={st.imgClear} onPress={clearImage}>
                  <Text style={st.imgClearTxt}>x  Remove</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Extract banner (upload tab) */}
            {bannerVisible && (
              <View style={[st.extractBanner, {
                backgroundColor: bannerSuccess ? 'rgba(82,168,124,0.1)' : 'rgba(224,154,42,0.1)',
                borderColor:     bannerSuccess ? 'rgba(82,168,124,0.3)' : 'rgba(224,154,42,0.3)',
              }]}>
                <Text style={[st.extractBannerTxt, { color: bannerSuccess ? '#52A87C' : '#E09A2A' }]}>
                  {bannerMsg}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Manual tab ── */}
        {activeTab === 'manual' && (
          <View>
            {/* Extract banner (manual tab) */}
            {bannerVisible && (
              <View style={[st.extractBanner, {
                backgroundColor: bannerSuccess ? 'rgba(82,168,124,0.1)' : 'rgba(224,154,42,0.1)',
                borderColor:     bannerSuccess ? 'rgba(82,168,124,0.3)' : 'rgba(224,154,42,0.3)',
                marginBottom: 14,
              }]}>
                <Text style={[st.extractBannerTxt, { color: bannerSuccess ? '#52A87C' : '#E09A2A' }]}>
                  {bannerMsg}
                </Text>
              </View>
            )}

            {CATEGORIES.map(cat => (
              <View key={cat.id} style={st.catBlock}>
                <TouchableOpacity style={st.catHead} onPress={() => toggleCat(cat.id)}>
                  <Text style={st.catHeadTxt}>{cat.label}</Text>
                  <Text style={st.catChevron}>{expanded[cat.id] ? '▾' : '▾'}</Text>
                </TouchableOpacity>

                {expanded[cat.id] && (
                  <View style={st.catBody}>
                    {cat.fields.map(f => {
                      const filled = !!(values[f.id] || '').trim();
                      return (
                        <View key={f.id} style={st.fieldWrap}>
                          <Text style={st.fieldLabel}>
                            {f.label}{' '}
                            <Text style={st.fieldUnit}>({f.unit})</Text>
                          </Text>
                          <TextInput
                            style={[st.fieldInput, filled && st.fieldInputFilled]}
                            value={values[f.id] || ''}
                            onChangeText={v => setVal(f.id, v)}
                            placeholder="—"
                            placeholderTextColor={mc.text3}
                            keyboardType="decimal-pad"
                          />
                          <Text style={st.fieldHint}>Normal: {f.hint}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Analyze button + loading ── */}
        <View style={st.analyzeRow}>
          <TouchableOpacity
            style={[st.analyzeBtn, loading && { opacity: 0.4 }]}
            onPress={analyze}
            disabled={loading}>
            <Text style={st.analyzeTxt}>Analyze</Text>
          </TouchableOpacity>
          {loading && (
            <View style={st.loadingRing}>
              <ActivityIndicator color={accentColor} size="small" />
              <Text style={st.loadingTxt}>{loadingText}</Text>
            </View>
          )}
        </View>

        {/* ── Results ── */}
        {result && !result.error && (
          <View ref={resultsRef} style={st.results}>

            {/* Overall card */}
            <View style={st.overallCard}>
              <View style={[st.overallDot, { backgroundColor: overallColor(result.overall_status) }]} />
              <View style={{ flex: 1 }}>
                <Text style={[st.overallStatus, { color: overallColor(result.overall_status) }]}>
                  {result.overall_status || 'Unknown'}
                </Text>
                <Text style={st.overallAssess}>{result.assessment || ''}</Text>
              </View>
            </View>

            {/* Warnings (critical) */}
            {Array.isArray(result.warnings) && result.warnings.length > 0 && (
              <View>
                <View style={st.resLabel}>
                  <Text style={st.resLabelTxt}>Urgent Attention</Text>
                  <View style={st.resLabelLine} />
                </View>
                {result.warnings.map((w, i) => (
                  <View key={i} style={st.warnItem}>
                    <Text style={st.warnTxt}>{w}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* All results flags grid */}
            <View>
              <View style={st.resLabel}>
                <Text style={st.resLabelTxt}>All Results</Text>
                <View style={st.resLabelLine} />
              </View>
              {Array.isArray(result.flags) && result.flags.length > 0 ? (
                <View style={st.flagsGrid}>
                  {result.flags.map((fl, i) => {
                    const status = (fl.status || 'normal').toLowerCase();
                    return (
                      <View
                        key={i}
                        style={[st.flagCard, { borderLeftColor: flagBorder(status, mc.border) }]}>
                        <Text style={st.flagTest}>{fl.test}</Text>
                        <Text style={st.flagValue}>{fl.value}</Text>
                        <View style={[st.flagChip, { backgroundColor: flagChipBg(status) }]}>
                          <Text style={[st.flagChipTxt, { color: flagChipColor(status, mc.text2) }]}>
                            {status.toUpperCase()}
                          </Text>
                        </View>
                        {fl.severity && status !== 'normal' && (
                          <Text style={st.flagSev}>{fl.severity}</Text>
                        )}
                        <Text style={st.flagRange}>Normal: {fl.normal_range || '—'}</Text>
                        {fl.impact ? (
                          <Text style={st.flagImpact}>{fl.impact}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ color: mc.text2, fontFamily: F.mono, fontSize: fontSize }}>
                  No specific flags to show.
                </Text>
              )}
            </View>

            {/* Caution note */}
            <View style={st.cautionNote}>
              <Text style={st.cautionTxt}>
                {result.caution || 'This is not medical advice. Consult a healthcare professional.'}
              </Text>
            </View>

            {/* Saved badge */}
            {saved && (
              <View style={st.savedBadge}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"
                  stroke="#52A87C" strokeWidth="2.5" strokeLinecap="round">
                  <Polyline points="20 6 9 17 4 12" />
                </Svg>
                <Text style={st.savedBadgeTxt}>
                  Saved to your profile — the AI will use this when making diet plans
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Result error */}
        {result?.error && (
          <Text style={{ color: C.red, fontFamily: F.mono, fontSize: fontSize, marginTop: 16 }}>
            {result.error}
          </Text>
        )}

        {/* ── History section ── */}
        <View style={st.historySection}>
          <View style={[st.resLabel, { marginTop: 8 }]}>
            <Text style={st.resLabelTxt}>Previous Scans</Text>
            <View style={st.resLabelLine} />
          </View>

          {/* History table header */}
          <View style={st.histTableHeader}>
            <Text style={[st.histTh, { flex: 1.2 }]}>Date</Text>
            <Text style={[st.histTh, { flex: 1 }]}>Status</Text>
            <Text style={[st.histTh, { flex: 1.2 }]}>Abnormal</Text>
            <Text style={[st.histTh, { flex: 2 }]}>Assessment</Text>
          </View>

          {history.length === 0 ? (
            <View style={st.histEmptyRow}>
              <Text style={st.histEmptyTxt}>
                No scans yet — analyze a report to see history here.
              </Text>
            </View>
          ) : (
            history.map((h, idx) => {
              const r = h.result || {};
              const status = r.overall_status || '—';
              const color = overallColor(status);
              const flags = Array.isArray(r.flags) ? r.flags : [];
              const abnormalFlags = flags.filter(f => (f.status || '').toLowerCase() !== 'normal');
              const dateStr = h.scanned_at
                ? (h.scanned_at.split('T')[0] || h.scanned_at.split(' ')[0])
                : '';
              const assess = (r.assessment || '');
              const assessShort = assess.length > 80 ? assess.substring(0, 80) + '...' : assess;
              const isExpanded = histExpanded[h.id || idx];

              return (
                <View key={h.id || idx}>
                  <TouchableOpacity
                    style={st.histRow}
                    onPress={() => toggleHistRow(h.id || idx)}>
                    <Text style={[st.histTd, { flex: 1.2, color: mc.text3, fontSize: 11 }]}>
                      {dateStr}
                    </Text>
                    <Text style={[st.histTd, { flex: 1, color, fontWeight: '700', fontSize: 11 }]}>
                      {status}
                    </Text>
                    <View style={{ flex: 1.2, flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingVertical: 10 }}>
                      {abnormalFlags.length === 0 ? (
                        <Text style={{ color: '#52A87C', fontFamily: F.mono, fontSize: 11 }}>All normal</Text>
                      ) : (
                        abnormalFlags.slice(0, 3).map((fl, fi) => {
                          const flStatus = (fl.status || '').toLowerCase();
                          const flColor = flStatus === 'high' ? '#E05252'
                            : flStatus === 'low' ? '#4A9EFF'
                            : '#E09A2A';
                          return (
                            <Text key={fi} style={{ color: flColor, fontFamily: F.mono, fontSize: 11 }}>
                              {fl.test}{fi < Math.min(abnormalFlags.length, 3) - 1 ? ', ' : ''}
                            </Text>
                          );
                        })
                      )}
                      {abnormalFlags.length > 3 && (
                        <Text style={{ color: mc.text2, fontFamily: F.mono, fontSize: 11 }}>
                          +{abnormalFlags.length - 3}
                        </Text>
                      )}
                    </View>
                    <Text style={[st.histTd, { flex: 2, color: mc.text2, lineHeight: 16 }]}>
                      {isExpanded ? assess : assessShort}
                    </Text>
                  </TouchableOpacity>

                  {/* Expanded history row */}
                  {isExpanded && (
                    <View style={st.histExpandRow}>
                      <View style={st.flagsGrid}>
                        {flags.map((fl, fi) => {
                          const fls = (fl.status || 'normal').toLowerCase();
                          return (
                            <View key={fi} style={[st.flagCard, { borderLeftColor: flagBorder(fls, mc.border) }]}>
                              <Text style={st.flagTest}>{fl.test}</Text>
                              <Text style={[st.flagValue, { fontSize: fontSize }]}>{fl.value}</Text>
                              <View style={[st.flagChip, { backgroundColor: flagChipBg(fls) }]}>
                                <Text style={[st.flagChipTxt, { color: flagChipColor(fls, mc.text2) }]}>
                                  {fls.toUpperCase()}
                                </Text>
                              </View>
                              <Text style={st.flagRange}>Normal: {fl.normal_range || '—'}</Text>
                            </View>
                          );
                        })}
                      </View>
                      {Array.isArray(r.warnings) && r.warnings.length > 0 && (
                        <Text style={{ color: '#E05252', fontFamily: F.mono, fontSize: 11, marginTop: 8 }}>
                          {r.warnings.join(' • ')}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

      </View>{/* end .body */}
    </ScrollView>
  );
}
