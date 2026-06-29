import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import Svg, { Path, Line, Rect, Circle, Polyline, Polygon } from 'react-native-svg';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { generalAiChat, getSessions, saveSessions, banComment, lookupBarcode } from '../api';
import BarcodeScanner from '../components/BarcodeScanner';
import { getToken, getUser } from '../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function MicIcon({ size = 13, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text3;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <Rect x="9" y="2" width="6" height="12" rx="3" />
      <Path d="M5 10a7 7 0 0 0 14 0" />
      <Line x1="12" y1="19" x2="12" y2="22" />
      <Line x1="8" y1="22" x2="16" y2="22" />
    </Svg>
  );
}

function SendIcon({ size = 14, color = '#080808' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
      <Line x1="22" y1="2" x2="11" y2="13" />
      <Polygon points="22 2 15 22 11 13 2 9 22 2" fill={color} />
    </Svg>
  );
}

function PlusIcon({ size = 14, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text3;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function ChatIcon({ size = 13, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text3;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

function CheckIcon() {
  const { mc } = useTheme();
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth="2" strokeLinecap="round">
      <Path d="M9 11l3 3L22 4" />
      <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Svg>
  );
}

function FireIcon() {
  const { mc } = useTheme();
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth="2" strokeLinecap="round">
      <Path d="M12 2c0 0-4 4-4 8a4 4 0 0 0 8 0c0-4-4-8-4-8z" />
      <Path d="M12 14v8" />
      <Path d="M9 19h6" />
    </Svg>
  );
}

function InfoIcon() {
  const { mc } = useTheme();
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth="2" strokeLinecap="round">
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="8" x2="12" y2="12" />
      <Line x1="12" y1="16" x2="12.01" y2="16" />
    </Svg>
  );
}

function CalendarIcon() {
  const { mc } = useTheme();
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth="2" strokeLinecap="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  );
}

function BarChartIcon() {
  const { mc } = useTheme();
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth="2" strokeLinecap="round">
      <Line x1="18" y1="20" x2="18" y2="10" />
      <Line x1="12" y1="20" x2="12" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="14" />
    </Svg>
  );
}

function HeartIcon() {
  const { mc } = useTheme();
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth="2" strokeLinecap="round">
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  );
}

function RegenIcon({ size = 12, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text2;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Polyline points="1 4 1 10 7 10" />
      <Path d="M3.51 15a9 9 0 1 0 .49-3.79" />
    </Svg>
  );
}

function CopyIcon({ size = 10, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text3;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Rect x="9" y="9" width="13" height="13" rx="1" />
      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

function TrashIcon({ size = 12, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text3;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <Path d="M10 11v6M14 11v6" />
      <Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Svg>
  );
}

function ExportIcon({ size = 12, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text3;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Polyline points="7 10 12 15 17 10" />
      <Line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  );
}

// ─── Chip definitions ─────────────────────────────────────────────────────────

const CHIPS = [
  { id: 'diet',     label: 'Build my plan',     Icon: CheckIcon },
  { id: 'roast',    label: 'Roast my diet',      Icon: FireIcon },
  { id: 'missing',  label: 'What am I missing?', Icon: InfoIcon },
  { id: '7day',     label: '7-day meal plan',    Icon: CalendarIcon },
  { id: 'calories', label: 'Calorie target',     Icon: BarChartIcon },
  { id: 'protein',  label: 'High-protein foods', Icon: HeartIcon },
];

const CHIP_PROMPTS = {
  diet:     'Make me a personalised diet plan.',
  missing:  'What micronutrients am I most likely deficient in, and exactly how do I fix each one through food or supplements?',
  '7day':   'Give me a practical 7-day healthy meal plan with breakfast, lunch, dinner and one snack each day. Make it realistic, not boring, and include rough calorie counts per meal.',
  calories: 'How many calories should I eat per day to lose 0.5 kg per week safely? Walk me through the full calculation based on my stats.',
  protein:  'What are the best high-protein foods I should be eating, and exactly how much protein do I need per day? Give me a practical list with amounts.',
};

const FUNNY = [
  "Consulting the broccoli elders...",
  "Asking 47 nutritionists who all disagree...",
  "Checking if pizza counts as a vegetable...",
  "Negotiating with your carbohydrates...",
  "Running the calorie math... running it again...",
  "Bribing the metabolism gnomes for insider tips...",
  "Translating your body's cryptic demands...",
  "Interrogating a rogue protein molecule...",
  "Calculating how many salads equal happiness...",
  "Convincing your metabolism to cooperate...",
  "Pretending I know what adaptogens are...",
  "Counting calories you haven't logged yet...",
  "Apologising to your vegetables on your behalf...",
  "Diplomatically not mentioning the samosa...",
  "Negotiating a peace treaty between your goals and your appetite...",
];

// ─── Diet keyword triggers ────────────────────────────────────────────────────

const DIET_TRIGGERS = [
  /build.{0,20}(me.{0,10})?(a.{0,5})?(diet|meal|nutrition|eating)/i,
  /create.{0,20}(me.{0,10})?(a.{0,5})?(diet|meal|nutrition|plan)/i,
  /make.{0,20}(me.{0,10})?(a.{0,5})?(diet|meal|plan)/i,
  /give.{0,20}(me.{0,10})?(a.{0,5})?(diet|meal|plan)/i,
  /design.{0,20}(a.{0,5})?(diet|meal|nutrition)/i,
  /what (should|can) i eat/i,
  /meal plan/i,
  /diet plan/i,
  /eating plan/i,
  /nutrition plan/i,
  /help.{0,10}(me.{0,5})?(diet|eat|meal)/i,
  /food plan/i,
];

function isDietQuery(text) {
  return DIET_TRIGGERS.some(r => r.test(text));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SESS_KEY = u => `toogood_sessions_${u}`;

function autoTitle(text = '') {
  let t = (text || '').trim().replace(/\n/g, ' ');
  const STRIP = /^(can you|could you|please|i want to|i want|i need to|i need|help me|tell me|show me|what is|what are|what's|how do i|how do|give me|make me a|make me|create a|create|build me|build a|make a|make)\s+/i;
  let prev;
  do { prev = t; t = t.replace(STRIP, ''); } while (t !== prev);
  t = t.replace(/[?!.]+$/, '').trim();
  if (!t) t = text.trim().slice(0, 48);
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 52) || 'Conversation';
}

// ─── Markdown text renderer ───────────────────────────────────────────────────

function parseLine(line) {
  // Returns array of {text, bold, italic}
  const out = [];
  let cur = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] === '*' && line[i + 1] === '*') {
      const end = line.indexOf('**', i + 2);
      if (end > -1) {
        if (cur) { out.push({ text: cur }); cur = ''; }
        out.push({ text: line.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }
    if (line[i] === '*') {
      const end = line.indexOf('*', i + 1);
      if (end > -1) {
        if (cur) { out.push({ text: cur }); cur = ''; }
        out.push({ text: line.slice(i + 1, end), italic: true });
        i = end + 1;
        continue;
      }
    }
    cur += line[i];
    i++;
  }
  if (cur) out.push({ text: cur });
  return out;
}

function MsgText({ text, mc, accentColor }) {
  const msgTxt = { fontFamily: F.mono, fontSize: 15, color: mc.text, lineHeight: 28, letterSpacing: 0.3 };
  const lines = (text || '').split('\n');
  return (
    <View>
      {lines.map((line, li) => {
        const isBullet = /^[\-\*•]\s/.test(line);
        const isHeader = /^#{1,3}\s/.test(line);
        const content = isBullet
          ? line.replace(/^[\-\*•]\s/, '')
          : isHeader
          ? line.replace(/^#+\s/, '')
          : line;
        const parts = parseLine(content);

        if (!content.trim() && !isBullet) {
          return <View key={li} style={{ height: 6 }} />;
        }

        return (
          <Text key={li} style={[
            msgTxt,
            isBullet && { marginLeft: 12 },
            isHeader && { fontFamily: F.display, fontSize: 16, color: mc.text, marginBottom: 4, marginTop: 8 },
          ]}>
            {isBullet ? <Text style={{ color: accentColor }}>{'• '}</Text> : null}
            {parts.map((p, pi) =>
              p.bold
                ? <Text key={pi} style={[msgTxt, { color: accentColor, fontWeight: '700' }]}>{p.text}</Text>
                : p.italic
                ? <Text key={pi} style={[msgTxt, { color: mc.text2, fontStyle: 'italic' }]}>{p.text}</Text>
                : <Text key={pi} style={msgTxt}>{p.text}</Text>
            )}
          </Text>
        );
      })}
    </View>
  );
}

// ─── Session row component ────────────────────────────────────────────────────

function SessRow({ s, cur, onOpen, onDel, mc, accentColor, st }) {
  const isCur = s.id === cur;
  return (
    <View style={st.sessRow}>
      <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={() => onOpen(s)}>
        <Text style={[st.sessTitle, isCur && { color: accentColor }]} numberOfLines={1}>
          {s.title}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onDel(s.id)} style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
        <TrashIcon size={11} color={mc.text3} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Message row component ────────────────────────────────────────────────────

function MessageRow({ msg, initials, onCopy, mc, accentColor, st }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(msg.content).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }

  return (
    <View style={[st.msgRow, isUser && st.msgRowUser]}>
      {isUser
        ? <View style={st.userAvatar}><Text style={st.avatarTxt}>{initials}</Text></View>
        : <View style={st.aiAvatar}><Text style={st.avatarTxt}>T</Text></View>
      }
      <View style={st.msgBubbleWrap}>
        <MsgText text={msg.content} mc={mc} accentColor={accentColor} />
        {Platform.OS === 'web' && (
          <View style={st.msgActions}>
            <TouchableOpacity style={st.msgActionBtn} onPress={handleCopy}>
              <CopyIcon size={10} color={copied ? accentColor : mc.text3} />
              <Text style={[st.msgActionTxt, copied && { color: accentColor }]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingRow({ funnyIdx, st }) {
  return (
    <View style={st.msgRow}>
      <View style={st.aiAvatar}><Text style={st.avatarTxt}>T</Text></View>
      <View style={st.msgBubbleWrap}>
        <Text style={st.thinkingTxt}>{FUNNY[funnyIdx % FUNNY.length]}</Text>
      </View>
    </View>
  );
}

// ─── Diet MCQ Modal ───────────────────────────────────────────────────────────

const MCQ_STEPS = [
  {
    id: 'goal', q: "What's the mission here?",
    opts: [
      { val: 'weight_loss', label: 'Lose weight',   desc: 'The eternal human struggle' },
      { val: 'weight_gain', label: 'Gain weight',   desc: 'Build up, fill out, get there' },
      { val: 'muscle_gain', label: 'Build muscle',  desc: 'Strength, size, and power' },
      { val: 'maintain',    label: 'Stay the same', desc: "Not broken, don't fix it" },
      { val: 'health',      label: 'Eat healthier', desc: 'Do the responsible thing, ugh' },
    ],
  },
  {
    id: 'meals', q: 'How many times a day do you eat?',
    opts: [
      { val: '2', label: '2 meals',  desc: 'Warrior mode / OMAD adjacent' },
      { val: '3', label: '3 meals',  desc: 'The classic human schedule' },
      { val: '4', label: '4 meals',  desc: 'Including a snack (very wise)' },
      { val: '5', label: '5+ meals', desc: 'Never not eating (respect)' },
    ],
  },
  {
    id: 'diet_type', q: "What's the dietary style?",
    opts: [
      { val: 'non_veg',    label: 'Non-veg',    desc: 'Full food chain, no regrets' },
      { val: 'veg',        label: 'Vegetarian', desc: 'Plants are friends AND food' },
      { val: 'vegan',      label: 'Vegan',      desc: 'Hardcore plants-only mode' },
      { val: 'eggetarian', label: 'Eggetarian', desc: 'Vegetarian but chickens owe you' },
    ],
  },
  {
    id: 'restrictions', q: 'Any strong food opinions?',
    opts: [
      { val: 'none',      label: 'None',       desc: 'Iron stomach, very blessed' },
      { val: 'no_dairy',  label: 'No dairy',   desc: 'Milk and I had a falling out' },
      { val: 'no_gluten', label: 'No gluten',  desc: 'Bread is the enemy' },
      { val: 'no_nuts',   label: 'No nuts',    desc: 'Tree nuts specifically' },
    ],
  },
  {
    id: 'duration', q: 'How long a plan are we cooking up?',
    opts: [
      { val: '1_day',   label: 'Just today',  desc: 'Living in the moment' },
      { val: '3_days',  label: '3-day plan',  desc: 'A solid mini-commitment' },
      { val: '1_week',  label: '1-week plan', desc: 'The responsible adult choice' },
      { val: '2_weeks', label: '2-week plan', desc: "Full lifestyle arc, let's go" },
    ],
  },
];

function buildDietPrompt(a) {
  const gMap = {
    weight_loss: 'weight loss — calorie deficit (300–500 kcal below TDEE), high protein, high fibre, filling whole foods',
    weight_gain: 'weight gain — calorie surplus (300–500 kcal above TDEE), high protein (1.6–2 g/kg), nutrient-dense calorie-rich foods, frequent meals',
    muscle_gain: 'muscle gain — moderate calorie surplus, very high protein (1.8–2.2 g/kg), complex carbs for training energy',
    maintain:    'weight maintenance — balanced macros, sustainable eating patterns',
    health:      'general health improvement — micronutrient-rich whole foods, variety, WHO guidelines',
  };
  const mMap = { '2': '2 meals/day', '3': '3 meals/day', '4': '4 meals/day (3 main + 1 snack)', '5': '5+ smaller meals/day' };
  const dMap = {
    non_veg:    'non-vegetarian (chicken, fish, eggs, lean meat all fine)',
    veg:        'vegetarian (no meat or fish; dairy and eggs fine)',
    vegan:      'vegan (zero animal products)',
    eggetarian: 'eggetarian (vegetarian + eggs; no meat or fish)',
  };
  const rMap = {
    none:      'no food restrictions',
    no_dairy:  'dairy-free (avoid milk, curd, paneer, cheese, butter)',
    no_gluten: 'gluten-free (avoid wheat, maida, regular bread — use rice, bajra, jowar)',
    no_nuts:   'nut-free (no tree nuts or groundnuts)',
  };
  const tMap = {
    '1_day':   '1 day (full single-day plan)',
    '3_days':  '3 days — vary meals each day',
    '1_week':  '7 days — full week, different meals daily',
    '2_weeks': '14 days — two full weeks, avoid repetition',
  };
  return `Create a detailed, personalised diet plan with these specifications:\n\n• Goal: ${gMap[a.goal] || a.goal}\n• Meals per day: ${mMap[a.meals] || a.meals}\n• Dietary type: ${dMap[a.diet_type] || a.diet_type}\n• Restrictions: ${rMap[a.restrictions] || a.restrictions}\n• Duration: ${tMap[a.duration] || a.duration}\n\nFor every meal include: specific foods with portion sizes in grams or standard measures, estimated kcal per meal, and protein / carbs / fat breakdown. End each day with a daily total (kcal, P, C, F). Keep the food practical, available in India, and something a real person would actually want to eat.`;
}

function DietMCQModal({ visible, onClose, onSubmit, mc, accentColor, st }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);

  function reset() {
    setStep(0);
    setAnswers({});
    setSelected(null);
  }

  function handleOpt(val) {
    setSelected(val);
  }

  function handleNext() {
    if (!selected) return;
    const cur = MCQ_STEPS[step];
    const newAnswers = { ...answers, [cur.id]: selected };
    setAnswers(newAnswers);
    setSelected(null);
    if (step + 1 >= MCQ_STEPS.length) {
      onSubmit(buildDietPrompt(newAnswers));
      reset();
    } else {
      setStep(step + 1);
    }
  }

  function handleSkip() {
    onClose();
    reset();
  }

  if (!visible) return null;

  const cur = MCQ_STEPS[step];
  const progress = ((step / MCQ_STEPS.length) * 100).toFixed(0);

  return (
    <View style={st.modalOverlay}>
      <View style={[st.modalCard, { position: 'relative' }]}>
        <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 12, right: 12, padding: 6 }}>
          <Text style={{ color: mc.text2, fontFamily: "'Courier Prime', monospace", fontSize: 16, lineHeight: 16 }}>✕</Text>
        </TouchableOpacity>
        <Text style={st.mcqEyebrow}>Question {step + 1} of {MCQ_STEPS.length}</Text>
        <View style={st.mcqProgBar}>
          <View style={[st.mcqProgFill, { width: `${progress}%` }]} />
        </View>
        <Text style={st.mcqQ}>{cur.q}</Text>
        <View style={st.mcqOpts}>
          {cur.opts.map(o => {
            const isSel = selected === o.val;
            return (
              <TouchableOpacity
                key={o.val}
                style={[st.mcqOpt, isSel && st.mcqOptSelected]}
                onPress={() => handleOpt(o.val)}
              >
                <View style={[st.mcqOptCheck, isSel && st.mcqOptCheckSel]}>
                  {isSel && (
                    <Svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#080808" strokeWidth="2.2" strokeLinecap="round">
                      <Polyline points="2,6 5,9 10,3" />
                    </Svg>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.mcqOptLabel, isSel && { color: accentColor }]}>{o.label}</Text>
                  <Text style={st.mcqOptDesc}>{o.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={st.mcqFooter}>
          <TouchableOpacity onPress={handleSkip}>
            <Text style={st.mcqSkip}>Skip — just wing it with the AI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.mcqNextBtn, !selected && st.mcqNextBtnOff]}
            onPress={handleNext}
            disabled={!selected}
          >
            <Text style={[st.mcqNextBtnTxt, !selected && { opacity: 0.3 }]}>
              {step + 1 >= MCQ_STEPS.length ? 'Build plan' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AIScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  const [username,   setUsername]   = useState('');
  const [sessions,   setSessions]   = useState([]);
  const [sessionId,  setSessionId]  = useState(() => `sess_${Date.now()}`);
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [showRoast,  setShowRoast]  = useState(false);
  const [roastText,  setRoastText]  = useState('');
  const [listening,  setListening]  = useState(false);
  const [showPlus,   setShowPlus]   = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showMCQ,    setShowMCQ]    = useState(false);
  const [wizardShown, setWizardShown] = useState(false);
  const [funnyIdx,   setFunnyIdx]   = useState(0);
  const [showRegen,  setShowRegen]  = useState(false);
  const [banUntil,   setBanUntil]   = useState(null);
  const [banRemaining, setBanRemaining] = useState(0);
  const [banInput,   setBanInput]   = useState('');
  const [banReply,   setBanReply]   = useState('');
  const [banSorryCount, setBanSorryCount] = useState(0);

  const scrollRef   = useRef(null);
  const recogRef    = useRef(null);
  const funnyTimer  = useRef(null);
  const plusRef     = useRef(null);

  // ── Load user & sessions ──────────────────────────────────────────

  useEffect(() => {
    getUser().then(u => {
      if (u) {
        const name = typeof u === 'string' ? u : (u.username || u.email || '');
        setUsername(name);
        loadSessions(name);
      }
    });
  }, []);

  // ── Click-outside for plus popup on web ──────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'web' || !showPlus) return;
    const handler = e => {
      if (plusRef.current && !plusRef.current.contains?.(e.target)) setShowPlus(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPlus]);

  // ── Barcode scan handler ──────────────────────────────────────────

  async function handleScanned(code) {
    setShowScanner(false);
    try {
      const p = await lookupBarcode(code);
      const brand = p.brand ? ` by ${p.brand}` : '';
      setInput(`I scanned ${p.name}${brand}. Per 100g: ${p.calories} kcal, ${p.protein}g protein, ${p.carbs}g carbs, ${p.fat}g fat (serving: ${p.serving}). Can you help me log this and tell me if it fits my goals?`);
    } catch {
      setInput(`I scanned barcode ${code} but couldn't find it in the database. Can you help me log it manually?`);
    }
  }

  // ── Funny ticker while loading ────────────────────────────────────

  useEffect(() => {
    if (loading) {
      setFunnyIdx(Math.floor(Math.random() * FUNNY.length));
      funnyTimer.current = setInterval(() => {
        setFunnyIdx(i => (i + 1) % FUNNY.length);
      }, 2600);
    } else {
      if (funnyTimer.current) { clearInterval(funnyTimer.current); funnyTimer.current = null; }
    }
    return () => { if (funnyTimer.current) clearInterval(funnyTimer.current); };
  }, [loading]);

  // ── Ban countdown ─────────────────────────────────────────────────

  useEffect(() => {
    if (!banUntil) return;
    function tick() {
      const rem = Math.max(0, Math.floor((banUntil - Date.now()) / 1000));
      setBanRemaining(rem);
      if (rem <= 0) setBanUntil(null);
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [banUntil]);

  // ── Auto-scroll ───────────────────────────────────────────────────

  function scrollToBottom() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  // ── Session persistence ───────────────────────────────────────────

  function loadSessions(u) {
    getSessions()
      .then(d => {
        if (d?.ok && d.sessions?.length) {
          setSessions(d.sessions);
          AsyncStorage.setItem(SESS_KEY(u), JSON.stringify(d.sessions));
        } else {
          AsyncStorage.getItem(SESS_KEY(u)).then(raw =>
            setSessions(raw ? JSON.parse(raw) : [])
          );
        }
      })
      .catch(() =>
        AsyncStorage.getItem(SESS_KEY(u)).then(raw =>
          setSessions(raw ? JSON.parse(raw) : [])
        )
      );
  }

  function storeSessions(list) {
    const trimmed = list.slice(0, 40);
    AsyncStorage.setItem(SESS_KEY(username), JSON.stringify(trimmed));
    setSessions(trimmed);
    saveSessions(trimmed).catch(() => {});
  }

  function persistCurrentSession(msgs, sid) {
    if (!msgs.length) return;
    const firstUser = msgs.find(m => m.role === 'user');
    const title = autoTitle(firstUser?.content || '');
    const entry = { id: sid || sessionId, title, history: [...msgs], updatedAt: Date.now() };
    AsyncStorage.getItem(SESS_KEY(username)).then(raw => {
      const all = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(s => s.id === entry.id);
      if (idx >= 0) all[idx] = entry; else all.unshift(entry);
      storeSessions(all);
    });
  }

  function openSession(sess) {
    persistCurrentSession(messages);
    setSessionId(sess.id);
    setMessages(sess.history || []);
    setShowRoast(false);
    setShowRegen(false);
    scrollToBottom();
  }

  function delSession(id) {
    AsyncStorage.getItem(SESS_KEY(username)).then(raw => {
      const all = raw ? JSON.parse(raw) : [];
      storeSessions(all.filter(s => s.id !== id));
    });
    if (id === sessionId) {
      setSessionId(`sess_${Date.now()}`);
      setMessages([]);
      setShowRegen(false);
    }
  }

  function newChat() {
    persistCurrentSession(messages);
    loadSessions(username);
    setSessionId(`sess_${Date.now()}`);
    setMessages([]);
    setShowRoast(false);
    setShowRegen(false);
    setWizardShown(false);
  }

  function clearChat() {
    setMessages([]);
    setShowRegen(false);
    AsyncStorage.getItem(SESS_KEY(username)).then(raw => {
      const all = raw ? JSON.parse(raw) : [];
      storeSessions(all.filter(s => s.id !== sessionId));
    });
  }

  function exportChat() {
    if (!messages.length || Platform.OS !== 'web') return;
    const txt = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n---\n\n');
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
    a.download = `too-good-chat-${Date.now()}.txt`;
    a.click();
  }

  // ── Core send ─────────────────────────────────────────────────────

  async function send(text) {
    text = (text || input).trim();
    if (!text || loading) return;
    if (isDietQuery(text) && !wizardShown) {
      setInput('');
      setShowMCQ(true);
      setWizardShown(true);
      return;
    }
    setInput('');
    setShowRoast(false);
    setShowPlus(false);
    setShowRegen(false);
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setLoading(true);
    scrollToBottom();
    try {
      const apiMsgs = next.map(m => ({ role: m.role, content: m.content }));
      const d = await generalAiChat(apiMsgs);
      if (d.banned) {
        if (d.reply) {
          const withReply = [...next, { role: 'assistant', content: d.reply }];
          setMessages(withReply);
          persistCurrentSession(withReply);
          scrollToBottom();
        }
        setBanUntil(new Date(d.ban_until + 'Z'));
        setBanSorryCount(0);
        setBanReply('');
        setBanInput('');
        setLoading(false);
        return;
      }
      const reply = d.reply || 'No response.';
      const withReply = [...next, { role: 'assistant', content: reply }];
      setMessages(withReply);
      persistCurrentSession(withReply);
      setShowRegen(true);
      scrollToBottom();
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: 'Could not reach server. Please try again.' }]);
    }
    setLoading(false);
  }

  // ── Regenerate last ───────────────────────────────────────────────

  function regenerateLast() {
    if (!messages.length || loading) return;
    const withoutLast = messages[messages.length - 1].role === 'assistant'
      ? messages.slice(0, -1)
      : messages;
    const lastUser = [...withoutLast].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    const trimmed = withoutLast.filter(
      (m, i) => !(i === withoutLast.length - 1 && m.role === 'user')
    );
    setMessages(trimmed);
    setShowRegen(false);
    send(lastUser.content);
  }

  // ── Ban comment submit ────────────────────────────────────────────

  async function submitBanComment() {
    const text = banInput.trim();
    if (!text) return;
    setBanInput('');
    setBanReply('...');
    try {
      const d = await banComment(text, banSorryCount);
      if (d.action === 'bypass') {
        setBanReply(d.msg || '');
        setTimeout(() => setBanUntil(null), 1200);
      } else if (d.action === 'sorry') {
        setBanSorryCount(c => c + 1);
        setBanUntil(new Date(d.new_ban_until + 'Z'));
        setBanReply(d.msg || '');
      } else if (d.action === 'insult') {
        setBanUntil(new Date(d.new_ban_until + 'Z'));
        setBanReply(d.msg || '');
      } else if (d.action === 'expired') {
        setBanUntil(null);
      } else {
        setBanReply(d.msg || '');
      }
    } catch {
      setBanReply('');
    }
  }

  // ── Chips ─────────────────────────────────────────────────────────

  function handleChip(id) {
    if (id === 'roast') { setShowRoast(v => !v); return; }
    if (id === 'diet')  { setShowMCQ(true); return; }
    const prompt = CHIP_PROMPTS[id];
    if (prompt) send(prompt);
  }

  function submitRoast() {
    if (!roastText.trim()) return;
    const prompt = `Roast my diet — be brutally honest but constructive. Here's what I typically eat in a day:\n\n${roastText.trim()}\n\nTell me exactly what's wrong with it, what nutrients I'm missing, and how to fix it.`;
    send(prompt);
    setRoastText('');
    setShowRoast(false);
  }

  // ── Mic (Web Speech API) ──────────────────────────────────────────

  function toggleMic() {
    if (Platform.OS !== 'web') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const r = new SR();
    r.lang = 'en-US';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = e => {
      const t = e.results[0][0].transcript;
      setInput(p => (p ? p + ' ' : '') + t);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    r.start();
    setListening(true);
  }

  // ── Derived ───────────────────────────────────────────────────────

  const initials = (username || '?')[0].toUpperCase();
  const DAY = 86400000;
  const now = Date.now();
  const todaySess     = sessions.filter(s => now - s.updatedAt < DAY);
  const yesterdaySess = sessions.filter(s => now - s.updatedAt >= DAY && now - s.updatedAt < 2 * DAY);
  const olderSess     = sessions.filter(s => now - s.updatedAt >= 2 * DAY);
  const chatTitleText = messages.length
    ? autoTitle(messages.find(m => m.role === 'user')?.content || '')
    : 'New conversation';

  // ── Render ────────────────────────────────────────────────────────

  const st = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: mc.bg,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },

  // ── Session sidebar ──────────────────────────────────────────────
  sessSidebar: {
    width: 240,
    backgroundColor: '#080808',
    borderRightWidth: 1,
    borderRightColor: mc.border,
    flexDirection: 'column',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: mc.border,
  },
  newChatTxt: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text2,
    letterSpacing: 1,
  },
  sessNav: {
    flex: 1,
    paddingVertical: 4,
  },
  sessEmpty: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text3,
    fontStyle: 'italic',
    padding: 14,
  },
  sessLabel: {
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 4,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    fontFamily: F.mono,
  },
  sessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sessTitle: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text2,
    letterSpacing: 0.5,
  },

  // ── Main area ────────────────────────────────────────────────────
  main: {
    flex: 1,
    flexDirection: 'column',
  },

  // ── Header ───────────────────────────────────────────────────────
  header: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: mc.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
    flexShrink: 0,
    backgroundColor: mc.bg,
  },
  chatTitle: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text2,
    letterSpacing: 1,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  headerBtnTxt: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text3,
    letterSpacing: 1,
  },
  headerSep: {
    width: 1,
    height: 16,
    backgroundColor: mc.border,
  },

  // ── Chat scroll ───────────────────────────────────────────────────
  chatScroll: {
    flex: 1,
  },

  // ── Empty state ───────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    paddingTop: 60,
    paddingBottom: 20,
    minHeight: 400,
  },
  esTitle: {
    fontFamily: F.display,
    fontSize: 28,
    color: mc.text,
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 36,
  },
  esSub: {
    fontSize: 15,
    color: mc.text2,
    fontStyle: 'italic',
    marginBottom: 40,
    letterSpacing: 0.5,
    textAlign: 'center',
    fontFamily: F.mono,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    maxWidth: 600,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 16,
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: Math.max(4, borderRadius - 2),
  },
  chipTxt: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text2,
    letterSpacing: 0.5,
  },

  // ── Roast prompt ──────────────────────────────────────────────────
  roastBox: {
    marginTop: 24,
    width: '100%',
    maxWidth: 520,
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: borderRadius,
    padding: 20,
  },
  roastQ: {
    fontFamily: F.display,
    fontSize: 15,
    color: mc.text,
    marginBottom: 12,
    lineHeight: 22,
  },
  roastInput: {
    backgroundColor: mc.elevated,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: Math.max(4, borderRadius - 2),
    color: mc.text,
    fontFamily: F.mono,
    fontSize: fontSize,
    padding: 10,
    minHeight: 80,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },
  roastActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  roastCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: borderRadius,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  roastCancelTxt: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text3,
    letterSpacing: 1,
  },
  roastSubmit: {
    backgroundColor: accentColor,
    borderRadius: borderRadius,
    paddingVertical: 7,
    paddingHorizontal: 18,
  },
  roastSubmitTxt: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    fontWeight: '700',
    color: '#080808',
    letterSpacing: 1,
  },

  // ── Messages ──────────────────────────────────────────────────────
  messages: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  msgRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: '10%',
    alignItems: 'flex-start',
  },
  msgRowUser: {
    backgroundColor: 'rgba(201,168,76,0.025)',
    flexDirection: 'row-reverse',
  },
  aiAvatar: {
    width: 26,
    height: 26,
    flexShrink: 0,
    backgroundColor: 'rgba(201,168,76,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  userAvatar: {
    width: 26,
    height: 26,
    flexShrink: 0,
    backgroundColor: 'rgba(201,168,76,0.16)',
    borderWidth: 1,
    borderColor: accentColor,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarTxt: {
    fontFamily: F.display,
    fontSize: 12,
    color: accentColor,
  },
  msgBubbleWrap: {
    flex: 1,
    maxWidth: 680,
  },
  msgTxt: {
    fontFamily: F.mono,
    fontSize: 15,
    color: mc.text,
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  msgActions: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
    opacity: 0.6,
  },
  msgActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: mc.border,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  msgActionTxt: {
    fontFamily: F.mono,
    fontSize: 11,
    color: mc.text3,
    letterSpacing: 1,
  },

  // ── Thinking indicator ────────────────────────────────────────────
  thinkingTxt: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text2,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // ── Regenerate bar ────────────────────────────────────────────────
  regenBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: mc.border,
    paddingVertical: 7,
    paddingHorizontal: 18,
  },
  regenBtnTxt: {
    fontFamily: F.mono,
    fontSize: 11,
    color: mc.text2,
    letterSpacing: 1,
  },

  // ── Composer ──────────────────────────────────────────────────────
  composer: {
    paddingVertical: 10,
    paddingHorizontal: '10%',
    paddingBottom: 20,
    backgroundColor: mc.bg,
    flexShrink: 0,
  },
  composerBox: {
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
    maxWidth: 740,
    alignSelf: 'center',
    width: '100%',
  },
  chatInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: mc.text,
    fontFamily: F.mono,
    fontSize: 15,
    letterSpacing: 0.3,
    lineHeight: 26,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    maxHeight: 200,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },
  composerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: mc.border,
  },
  cbLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cbRight: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cbBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 2,
  },
  cbBtnListening: {
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  charCount: {
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 1,
    fontFamily: F.mono,
  },

  // ── Plus popup ────────────────────────────────────────────────────
  plusPopup: {
    position: 'absolute',
    bottom: 44,
    left: 0,
    backgroundColor: mc.elevated,
    borderWidth: 1,
    borderColor: mc.borderH,
    minWidth: 190,
    zIndex: 300,
  },
  plusItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  plusItemTxt: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text2,
    letterSpacing: 0.5,
  },

  // ── Send button ───────────────────────────────────────────────────
  sendBtn: {
    width: 32,
    height: 32,
    backgroundColor: accentColor,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnOff: {
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
  },
  composerNote: {
    maxWidth: 740,
    alignSelf: 'center',
    width: '100%',
    marginTop: 7,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text3,
    letterSpacing: 1,
    textAlign: 'center',
    fontFamily: F.mono,
  },

  // ── Ban Overlay ───────────────────────────────────────────────────
  banOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 999,
    backgroundColor: '#080808',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  banCard: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 8,
  },
  banIcon: {
    fontSize: 52,
    marginBottom: 20,
  },
  banTitle: {
    fontFamily: F.display,
    fontSize: 28,
    color: accentColor,
    marginBottom: 12,
    letterSpacing: 1,
    textAlign: 'center',
  },
  banMsg: {
    fontSize: 14,
    color: mc.text2,
    lineHeight: 24,
    marginBottom: 28,
    textAlign: 'center',
    fontFamily: F.mono,
  },
  banClock: {
    fontFamily: F.display,
    fontSize: 48,
    color: mc.text,
    letterSpacing: 2,
    marginBottom: 8,
  },
  banClockLabel: {
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginBottom: 28,
    fontFamily: F.mono,
  },
  banCommentWrap: {
    marginTop: 4,
    width: '100%',
  },
  banCommentLabel: {
    fontSize: 11,
    color: mc.text3,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
    fontFamily: F.mono,
  },
  banCommentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  banCommentInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: mc.border,
    color: mc.text,
    fontFamily: F.mono,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },
  banCommentBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  banCommentBtnTxt: {
    fontFamily: F.mono,
    fontSize: 11,
    color: accentColor,
    letterSpacing: 2,
  },
  banCommentReply: {
    fontSize: 12,
    color: accentColor,
    marginTop: 12,
    fontFamily: F.mono,
    lineHeight: 20,
  },

  // ── Diet MCQ Modal ────────────────────────────────────────────────
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
  },
  modalCard: {
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.borderH,
    width: 500,
    maxWidth: '92%',
    padding: 28,
    paddingTop: 32,
  },
  mcqEyebrow: {
    fontSize: 9,
    color: mc.text3,
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: F.mono,
  },
  mcqProgBar: {
    height: 2,
    backgroundColor: 'rgba(201,168,76,0.10)',
    marginBottom: 26,
  },
  mcqProgFill: {
    height: '100%',
    backgroundColor: accentColor,
  },
  mcqQ: {
    fontFamily: F.display,
    fontSize: 21,
    color: mc.text,
    lineHeight: 28,
    marginBottom: 22,
  },
  mcqOpts: {
    gap: 10,
    marginBottom: 14,
  },
  mcqOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.elevated,
    borderWidth: 1,
    borderColor: mc.border,
    padding: 13,
    paddingLeft: 12,
  },
  mcqOptSelected: {
    borderColor: accentColor,
    backgroundColor: mc.goldDim,
  },
  mcqOptCheck: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mcqOptCheckSel: {
    backgroundColor: accentColor,
    borderColor: accentColor,
  },
  mcqOptLabel: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  mcqOptDesc: {
    fontFamily: F.mono,
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 0.5,
    fontStyle: 'italic',
  },
  mcqFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  mcqSkip: {
    fontFamily: F.mono,
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 0.5,
  },
  mcqNextBtn: {
    backgroundColor: accentColor,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  mcqNextBtnOff: {
    opacity: 0.3,
  },
  mcqNextBtnTxt: {
    fontFamily: F.mono,
    fontSize: fontSize,
    fontWeight: '700',
    color: '#080808',
    letterSpacing: 2,
  },
});

  return (
    <View style={st.screen}>
      <View style={st.layout}>

        {/* ── SESSION SIDEBAR ── */}
        <View style={st.sessSidebar}>
          <TouchableOpacity style={st.newChatBtn} onPress={newChat}>
            <PlusIcon size={12} color={mc.text2} />
            <Text style={st.newChatTxt}>New conversation</Text>
          </TouchableOpacity>

          <ScrollView style={st.sessNav} showsVerticalScrollIndicator={false}>
            {sessions.length === 0 && (
              <Text style={st.sessEmpty}>No saved conversations yet.</Text>
            )}
            {todaySess.length > 0 && (
              <>
                <Text style={st.sessLabel}>TODAY</Text>
                {todaySess.map(s => (
                  <SessRow key={s.id} s={s} cur={sessionId} onOpen={openSession} onDel={delSession} mc={mc} accentColor={accentColor} st={st} />
                ))}
              </>
            )}
            {yesterdaySess.length > 0 && (
              <>
                <Text style={st.sessLabel}>YESTERDAY</Text>
                {yesterdaySess.map(s => (
                  <SessRow key={s.id} s={s} cur={sessionId} onOpen={openSession} onDel={delSession} mc={mc} accentColor={accentColor} st={st} />
                ))}
              </>
            )}
            {olderSess.length > 0 && (
              <>
                <Text style={st.sessLabel}>OLDER</Text>
                {olderSess.map(s => (
                  <SessRow key={s.id} s={s} cur={sessionId} onOpen={openSession} onDel={delSession} mc={mc} accentColor={accentColor} st={st} />
                ))}
              </>
            )}
          </ScrollView>
        </View>

        {/* ── MAIN AREA ── */}
        <View style={st.main}>

          {/* Header */}
          <View style={st.header}>
            <ChatIcon size={13} color={mc.text3} />
            <Text style={st.chatTitle} numberOfLines={1}>{chatTitleText}</Text>
            <TouchableOpacity style={st.headerBtn} onPress={exportChat}>
              <ExportIcon size={12} color={mc.text3} />
              <Text style={st.headerBtnTxt}>Export</Text>
            </TouchableOpacity>
            <View style={st.headerSep} />
            <TouchableOpacity style={st.headerBtn} onPress={clearChat}>
              <TrashIcon size={12} color={mc.text3} />
              <Text style={st.headerBtnTxt}>Clear</Text>
            </TouchableOpacity>
          </View>

          {/* Chat scroll */}
          <ScrollView
            ref={scrollRef}
            style={st.chatScroll}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Empty state */}
            {messages.length === 0 && !loading && (
              <View style={st.emptyState}>
                <Text style={st.esTitle}>
                  {'What can I help with, '}
                  <Text style={{ color: accentColor }}>{username.split('@')[0] || 'you'}</Text>
                  {'?'}
                </Text>
                <Text style={st.esSub}>
                  Diet plans · Food analysis · Calorie math · Judging your choices (kindly)
                </Text>
                <View style={st.chips}>
                  {CHIPS.map(c => (
                    <TouchableOpacity key={c.id} style={st.chip} onPress={() => handleChip(c.id)}>
                      <c.Icon />
                      <Text style={st.chipTxt}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Roast prompt box */}
                {showRoast && (
                  <View style={st.roastBox}>
                    <Text style={st.roastQ}>
                      Describe what you eat in a typical day — be honest, I won't tell anyone.
                    </Text>
                    <TextInput
                      style={st.roastInput}
                      value={roastText}
                      onChangeText={setRoastText}
                      placeholder="e.g. Breakfast: chai and paratha. Lunch: rice, dal, sabzi. Dinner: roti and paneer..."
                      placeholderTextColor={mc.text3}
                      multiline
                      numberOfLines={3}
                    />
                    <View style={st.roastActions}>
                      <TouchableOpacity style={st.roastCancel} onPress={() => setShowRoast(false)}>
                        <Text style={st.roastCancelTxt}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={st.roastSubmit} onPress={submitRoast}>
                        <Text style={st.roastSubmitTxt}>Roast it →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Messages */}
            <View style={st.messages}>
              {messages.map((m, i) => (
                <MessageRow key={i} msg={m} initials={initials} mc={mc} accentColor={accentColor} st={st} />
              ))}
              {loading && <ThinkingRow funnyIdx={funnyIdx} st={st} />}
            </View>
          </ScrollView>

          {/* Regenerate bar */}
          {showRegen && !loading && (
            <View style={st.regenBar}>
              <TouchableOpacity style={st.regenBtn} onPress={regenerateLast}>
                <RegenIcon size={12} color={mc.text2} />
                <Text style={st.regenBtnTxt}>Regenerate response</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Composer */}
          <View style={st.composer}>
            <View style={st.composerBox}>
              <TextInput
                style={st.chatInput}
                value={input}
                onChangeText={setInput}
                placeholder="Ask me anything. I won't judge. (Much.)"
                placeholderTextColor={mc.text3}
                multiline
                returnKeyType="send"
                onSubmitEditing={() => send()}
                blurOnSubmit={false}
                onKeyPress={(e) => {
                  if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                    e.preventDefault && e.preventDefault();
                    send();
                  }
                }}
              />
              <View style={st.composerBottom}>
                {/* Left controls */}
                <View style={st.cbLeft}>
                  {/* Plus button */}
                  <View ref={plusRef} style={{ position: 'relative' }}>
                    <TouchableOpacity
                      style={st.cbBtn}
                      onPress={() => setShowPlus(v => !v)}
                    >
                      <PlusIcon size={14} color={mc.text3} />
                    </TouchableOpacity>
                    {showPlus && (
                      <View style={st.plusPopup}>
                        <TouchableOpacity style={st.plusItem} onPress={() => { setShowPlus(false); setShowScanner(true); }}>
                          <Text style={st.plusItemTxt}>Scan barcode</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={st.plusItem} onPress={() => setShowPlus(false)}>
                          <Text style={st.plusItemTxt}>Upload file / photo</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Mic button */}
                  <TouchableOpacity
                    style={[st.cbBtn, listening && st.cbBtnListening]}
                    onPress={toggleMic}
                  >
                    <MicIcon size={13} color={listening ? accentColor : mc.text3} />
                  </TouchableOpacity>
                </View>

                {/* Right controls */}
                <View style={st.cbRight}>
                  {input.length > 80 && (
                    <Text style={st.charCount}>{input.length}</Text>
                  )}
                  <TouchableOpacity
                    style={[st.sendBtn, (!input.trim() || loading) && st.sendBtnOff]}
                    onPress={() => send()}
                    disabled={!input.trim() || loading}
                  >
                    {loading
                      ? <ActivityIndicator size="small" color={mc.text3} />
                      : <SendIcon size={14} color={input.trim() ? '#080808' : mc.text3} />
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <Text style={st.composerNote}>
              Not medical advice. Consult a real dietitian — I'm an AI, not a doctor, despite what my confidence suggests.
            </Text>
          </View>

        </View>
      </View>

      {/* Diet MCQ Modal */}
      <DietMCQModal
        visible={showMCQ}
        onClose={() => setShowMCQ(false)}
        onSubmit={prompt => { setShowMCQ(false); send(prompt); }}
        mc={mc}
        accentColor={accentColor}
        st={st}
      />

      {/* Barcode Scanner */}
      <BarcodeScanner
        visible={showScanner}
        onScanned={handleScanned}
        onClose={() => setShowScanner(false)}
      />

      {/* Ban Overlay */}
      {banUntil && (
        <View style={st.banOverlay}>
          <View style={st.banCard}>
            <Text style={st.banIcon}>😠</Text>
            <Text style={st.banTitle}>You're in timeout.</Text>
            <Text style={st.banMsg}>
              {"The AI needed a breather after that last one.\nSit quietly, reflect, maybe eat a vegetable.\n\nNext time talk properly 😊"}
            </Text>
            <Text style={st.banClock}>
              {String(Math.floor(banRemaining / 60)).padStart(2, '0')}:{String(banRemaining % 60).padStart(2, '0')}
            </Text>
            <Text style={st.banClockLabel}>remaining</Text>
            <View style={st.banCommentWrap}>
              <Text style={st.banCommentLabel}>Do you have anything to say?</Text>
              <View style={st.banCommentRow}>
                <TextInput
                  style={st.banCommentInput}
                  value={banInput}
                  onChangeText={setBanInput}
                  placeholder="Type here..."
                  placeholderTextColor={mc.text3}
                  maxLength={200}
                  autoComplete="off"
                  onSubmitEditing={submitBanComment}
                  returnKeyType="send"
                  blurOnSubmit={false}
                />
                <TouchableOpacity style={st.banCommentBtn} onPress={submitBanComment}>
                  <Text style={st.banCommentBtnTxt}>Send</Text>
                </TouchableOpacity>
              </View>
              {!!banReply && <Text style={st.banCommentReply}>{banReply}</Text>}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

