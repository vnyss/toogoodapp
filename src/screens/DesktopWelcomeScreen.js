import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon } from 'react-native-svg';
import LogoSvg from '../LogoSvg';
import { C, F } from '../theme';

const FEATURES = [
  {
    icon: 'welcome',
    accent: '#C9A84C',
    title: 'Welcome to Too Good',
    subtitle: 'Your personal health & fitness companion',
    description: 'Everything you need to reach your goals — nutrition, workouts, sleep, and AI coaching — all in one beautiful app.',
  },
  {
    icon: 'ai',
    accent: '#4FC9A4',
    title: 'AI Assistant & Coach',
    subtitle: 'Your 24/7 personal expert',
    description: 'Ask anything about nutrition, training, or health. Get personalized plans, answers, and motivation from an AI that knows your goals.',
  },
  {
    icon: 'log',
    accent: '#C9A84C',
    title: 'Log Today',
    subtitle: 'Track everything in seconds',
    description: 'Log food, sleep, and water — just speak naturally. Our AI understands "I had chicken rice for lunch" and fills in your diary automatically.',
  },
  {
    icon: 'workout',
    accent: '#4F8FC9',
    title: 'Workouts & Fitness',
    subtitle: 'Train smarter, not harder',
    description: 'Log workouts, follow guided sessions, HIIT timers, exercise library, gym progress charts, and full program tracking.',
  },
  {
    icon: 'health',
    accent: '#C94F6C',
    title: 'Health Tracking',
    subtitle: 'See the full picture',
    description: 'Steps, sleep quality, blood markers, health risk scores, BMI, period tracking, and reminders — all synced and visualised.',
  },
  {
    icon: 'nutrition',
    accent: '#4FC9A4',
    title: 'Nutrition & Meals',
    subtitle: 'Eat with intention',
    description: 'Barcode scanner, macro tracking, meal planner, recipe library, nutrient deep-dives, and smart food goal targets.',
  },
  {
    icon: 'goals',
    accent: '#C9A84C',
    title: 'Goals & Progress',
    subtitle: 'Watch yourself transform',
    description: 'Smart targets, transformation photos, score system, challenges, and a calendar view so you never lose sight of how far you\'ve come.',
  },
];

function FeatureIcon({ name, color, size = 64 }) {
  const s = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'ai')       return <Svg {...s}><Circle cx={12} cy={12} r={3} /><Path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></Svg>;
  if (name === 'log')      return <Svg {...s}><Path d="M12 20h9" /><Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></Svg>;
  if (name === 'workout')  return <Svg {...s}><Path d="M6.5 6.5h11M6.5 17.5h11M3 12h18" /><Circle cx={3} cy={6.5} r={1.5} /><Circle cx={3} cy={17.5} r={1.5} /><Circle cx={21} cy={6.5} r={1.5} /><Circle cx={21} cy={17.5} r={1.5} /></Svg>;
  if (name === 'health')   return <Svg {...s}><Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Svg>;
  if (name === 'nutrition')return <Svg {...s}><Path d="M18 8h1a4 4 0 0 1 0 8h-1" /><Path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><Line x1={6} y1={1} x2={6} y2={4} /><Line x1={10} y1={1} x2={10} y2={4} /><Line x1={14} y1={1} x2={14} y2={4} /></Svg>;
  if (name === 'goals')    return <Svg {...s}><Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></Svg>;
  // welcome — logo handled separately
  return null;
}

function Dots({ total, current, accent }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === current ? accent : 'rgba(255,255,255,0.2)',
          }}
        />
      ))}
    </View>
  );
}

export default function DesktopWelcomeScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const feature = FEATURES[step];
  const isLast = step === FEATURES.length - 1;

  function goTo(next) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(next), 150);
  }

  return (
    <View style={s.root}>
      {/* Left panel — feature display */}
      <View style={[s.left, { borderRightColor: feature.accent + '22' }]}>
        <Animated.View style={[s.leftInner, { opacity: fadeAnim }]}>
          {/* Icon */}
          <View style={[s.iconWrap, { backgroundColor: feature.accent + '15', borderColor: feature.accent + '30' }]}>
            {feature.icon === 'welcome'
              ? <LogoSvg color={feature.accent} size={64} />
              : <FeatureIcon name={feature.icon} color={feature.accent} size={56} />
            }
          </View>

          {/* Text */}
          <Text style={[s.subtitle, { color: feature.accent }]}>{feature.subtitle}</Text>
          <Text style={s.title}>{feature.title}</Text>
          <Text style={s.desc}>{feature.description}</Text>
        </Animated.View>

        {/* Dots */}
        <View style={s.dotsRow}>
          <Dots total={FEATURES.length} current={step} accent={feature.accent} />
        </View>
      </View>

      {/* Right panel — navigation */}
      <View style={s.right}>
        {/* Brand */}
        <View style={s.brand}>
          <LogoSvg color={C.gold} size={28} />
          <Text style={s.brandName}>Too Good</Text>
        </View>

        {/* Step counter */}
        <Text style={s.stepCount}>{step + 1} / {FEATURES.length}</Text>

        {/* Nav buttons */}
        <View style={s.navButtons}>
          {!isLast ? (
            <>
              <TouchableOpacity style={[s.btnPrimary, { backgroundColor: feature.accent }]} onPress={() => goTo(step + 1)}>
                <Text style={s.btnPrimaryTxt}>Next →</Text>
              </TouchableOpacity>

              {step > 0 && (
                <TouchableOpacity style={s.btnBack} onPress={() => goTo(step - 1)}>
                  <Text style={s.btnBackTxt}>← Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={s.btnSkip} onPress={onDone}>
                <Text style={s.btnSkipTxt}>Skip tour</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={[s.btnPrimary, { backgroundColor: feature.accent }]} onPress={onDone}>
                <Text style={s.btnPrimaryTxt}>Get Started →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnBack} onPress={() => goTo(step - 1)}>
                <Text style={s.btnBackTxt}>← Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Feature list preview */}
        <View style={s.featureList}>
          {FEATURES.slice(1).map((f, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i + 1)} style={s.featureItem}>
              <View style={[s.featureDot, { backgroundColor: (i + 1) <= step ? f.accent : 'transparent', borderColor: f.accent }]} />
              <Text style={[s.featureItemTxt, { color: (i + 1) === step ? f.accent : 'rgba(255,255,255,0.4)' }]}>{f.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, flexDirection: 'row', backgroundColor: C.bg },
  left:          { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 64, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)' },
  leftInner:     { alignItems: 'center', maxWidth: 480 },
  iconWrap:      { width: 120, height: 120, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  subtitle:      { fontFamily: F.mono, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 },
  title:         { fontFamily: F.display, fontSize: 36, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 20, letterSpacing: -0.5 },
  desc:          { fontFamily: F.mono, fontSize: 15, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 26 },
  dotsRow:       { position: 'absolute', bottom: 40, flexDirection: 'row' },

  right:         { width: 300, backgroundColor: C.sidebar, borderLeftWidth: 1, borderLeftColor: C.border, padding: 32, justifyContent: 'space-between' },
  brand:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  brandName:     { fontFamily: F.display, fontWeight: '700', fontSize: 18, color: C.text },
  stepCount:     { fontFamily: F.mono, fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 32 },

  navButtons:    { gap: 10 },
  btnPrimary:    { paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', borderRadius: 2 },
  btnPrimaryTxt: { fontFamily: F.mono, fontSize: 13, fontWeight: '700', color: '#000', letterSpacing: 1 },
  btnBack:       { paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
  btnBackTxt:    { fontFamily: F.mono, fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  btnSkip:       { paddingVertical: 8, alignItems: 'center' },
  btnSkipTxt:    { fontFamily: F.mono, fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5 },

  featureList:   { gap: 6, marginTop: 8 },
  featureItem:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  featureDot:    { width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  featureItemTxt:{ fontFamily: F.mono, fontSize: 11, letterSpacing: 0.3 },
});
