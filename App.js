import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle, Line, Rect, Polyline, Polygon } from 'react-native-svg';
import { C } from './src/theme';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import { getToken, getUser, clearAuth } from './src/auth';
import LoginScreen       from './src/screens/LoginScreen';
import OnboardingScreen  from './src/screens/OnboardingScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AIScreen        from './src/screens/AIScreen';
import CoachScreen     from './src/screens/CoachScreen';
import LogScreen       from './src/screens/LogScreen';
import AdaptScreen     from './src/screens/AdaptScreen';
import ExerciseScreen  from './src/screens/ExerciseScreen';
import CalendarScreen  from './src/screens/CalendarScreen';
import DiaryScreen     from './src/screens/DiaryScreen';
import ScoreScreen     from './src/screens/ScoreScreen';
import SocialsScreen    from './src/screens/SocialsScreen';
import ProfileScreen    from './src/screens/ProfileScreen';
import MonitorScreen    from './src/screens/MonitorScreen';
import SettingsScreen   from './src/screens/SettingsScreen';
import ChallengesScreen    from './src/screens/ChallengesScreen';
import ClubsScreen         from './src/screens/ClubsScreen';
import SegmentsScreen      from './src/screens/SegmentsScreen';
import WorkoutScreen        from './src/screens/WorkoutScreen';
import ExerciseLibraryScreen from './src/screens/ExerciseLibraryScreen';
import GymProgressScreen    from './src/screens/GymProgressScreen';
import GymToolsScreen       from './src/screens/GymToolsScreen';
import StepTrackerScreen    from './src/screens/StepTrackerScreen';
import WaterTrackerScreen   from './src/screens/WaterTrackerScreen';
import SleepTrackerScreen   from './src/screens/SleepTrackerScreen';
import GuidedWorkoutScreen  from './src/screens/GuidedWorkoutScreen';
import WorkoutProgramsScreen from './src/screens/WorkoutProgramsScreen';
import HIITTimerScreen      from './src/screens/HIITTimerScreen';
import FastingScreen        from './src/screens/FastingScreen';
import PeriodScreen        from './src/screens/PeriodScreen';
import HealthRiskScreen    from './src/screens/HealthRiskScreen';
import RecipeScreen        from './src/screens/RecipeScreen';
import MealPlanScreen      from './src/screens/MealPlanScreen';
import TransformationScreen from './src/screens/TransformationScreen';
import RemindersScreen     from './src/screens/RemindersScreen';
import NutrientsScreen     from './src/screens/NutrientsScreen';
import BMIScreen           from './src/screens/BMIScreen';

const SCREENS = {
  dashboard:  DashboardScreen,
  ai:         AIScreen,
  log:        LogScreen,
  adapt:      AdaptScreen,
  coach:      CoachScreen,
  exercise:   ExerciseScreen,
  calendar:   CalendarScreen,
  diary:      DiaryScreen,
  score:      ScoreScreen,
  socials:    SocialsScreen,
  profile:    ProfileScreen,
  monitor:    MonitorScreen,
  settings:   SettingsScreen,
  workout:         WorkoutScreen,
  exerciselibrary: ExerciseLibraryScreen,
  gymprogress:     GymProgressScreen,
  gymtools:        GymToolsScreen,
  steps:           StepTrackerScreen,
  water:           WaterTrackerScreen,
  sleep:           SleepTrackerScreen,
  guidedworkout:   GuidedWorkoutScreen,
  programs:        WorkoutProgramsScreen,
  hiittimer:       HIITTimerScreen,
  challenges:      ChallengesScreen,
  clubs:           ClubsScreen,
  segments:        SegmentsScreen,
  fasting:         FastingScreen,
  period:          PeriodScreen,
  healthrisk:      HealthRiskScreen,
  recipe:          RecipeScreen,
  mealplan:        MealPlanScreen,
  transformation:  TransformationScreen,
  reminders:       RemindersScreen,
  nutrients:       NutrientsScreen,
  bmi:             BMIScreen,
};

/* ── SVG icons matching the website ── */
function Icon({ name, size = 14, color }) {
  const c = color || C.text2;
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'dashboard') return <Svg {...p}><Rect x={3} y={3} width={18} height={18} /><Line x1={3} y1={9} x2={21} y2={9} /><Line x1={9} y1={21} x2={9} y2={9} /></Svg>;
  if (name === 'ai')        return <Svg {...p}><Circle cx={12} cy={12} r={3} /><Path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></Svg>;
  if (name === 'log')       return <Svg {...p}><Path d="M12 20h9" /><Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></Svg>;
  if (name === 'adapt')     return <Svg {...p}><Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Svg>;
  if (name === 'coach')     return <Svg {...p}><Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><Path d="M19 10v2a7 7 0 0 1-14 0v-2" /><Line x1={12} y1={19} x2={12} y2={23} /><Line x1={8} y1={23} x2={16} y2={23} /></Svg>;
  if (name === 'exercise')  return <Svg {...p}><Path d="M6.5 6.5h11M6.5 17.5h11M3 12h18" /><Circle cx={3} cy={6.5} r={1.5} /><Circle cx={3} cy={17.5} r={1.5} /><Circle cx={21} cy={6.5} r={1.5} /><Circle cx={21} cy={17.5} r={1.5} /></Svg>;
  if (name === 'calendar')  return <Svg {...p}><Rect x={3} y={4} width={18} height={18} rx={2} ry={2} /><Line x1={16} y1={2} x2={16} y2={6} /><Line x1={8} y1={2} x2={8} y2={6} /><Line x1={3} y1={10} x2={21} y2={10} /></Svg>;
  if (name === 'diary')     return <Svg {...p}><Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></Svg>;
  if (name === 'score')     return <Svg {...p}><Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></Svg>;
  if (name === 'socials')   return <Svg {...p}><Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><Circle cx={9} cy={7} r={4} /><Path d="M23 21v-2a4 4 0 0 0-3-3.87" /><Path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>;
  if (name === 'profile')   return <Svg {...p}><Circle cx={12} cy={8} r={4} /><Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></Svg>;
  if (name === 'monitor')    return <Svg {...p}><Path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Svg>;
  if (name === 'settings')   return <Svg {...p}><Circle cx={12} cy={12} r={3} /><Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Svg>;
  if (name === 'challenges') return <Svg {...p}><Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><Path d="M4 22h16" /><Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><Path d="M18 2H6v7a6 6 0 0 0 12 0V2z" /></Svg>;
  if (name === 'clubs')      return <Svg {...p}><Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><Circle cx={9} cy={7} r={4} /><Path d="M23 21v-2a4 4 0 0 0-3-3.87" /><Path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>;
  if (name === 'segments')     return <Svg {...p}><Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><Line x1={4} y1={22} x2={4} y2={15} /></Svg>;
  if (name === 'workout')      return <Svg {...p}><Path d="M6.5 6.5h11M6.5 17.5h11M3 12h18" /><Circle cx={3} cy={6.5} r={1.5} /><Circle cx={3} cy={17.5} r={1.5} /><Circle cx={21} cy={6.5} r={1.5} /><Circle cx={21} cy={17.5} r={1.5} /></Svg>;
  if (name === 'exerciselibrary') return <Svg {...p}><Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></Svg>;
  if (name === 'gymprogress')  return <Svg {...p}><Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Svg>;
  if (name === 'gymtools')     return <Svg {...p}><Circle cx={12} cy={12} r={3} /><Path d="m12 1 1 4h-2zm0 22-1-4h2zM4.22 4.22l2.83 2.83-1.42 1.42zm13.95 13.95 2.83 2.83-1.42-1.42zM1 12l4-1v2zm22 0-4 1v-2zM4.22 19.78l2.83-2.83-1.42-1.42zm13.95-13.95 2.83-2.83-1.42 1.42z" /></Svg>;
  if (name === 'steps')         return <Svg {...p}><Path d="M13 4v16M7 8v12M19 2v18M1 12v8" /></Svg>;
  if (name === 'water')         return <Svg {...p}><Path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></Svg>;
  if (name === 'sleep')         return <Svg {...p}><Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></Svg>;
  if (name === 'guidedworkout') return <Svg {...p}><Path d="M5 3l14 9-14 9V3z" /></Svg>;
  if (name === 'programs')     return <Svg {...p}><Rect x={3} y={4} width={18} height={18} rx={2} /><Path d="M16 2v4M8 2v4M3 10h18" /><Path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></Svg>;
  if (name === 'hiittimer')    return <Svg {...p}><Circle cx={12} cy={12} r={10} /><Path d="M12 6v6l3 3" /><Path d="M16.24 7.76 18 6" /></Svg>;
  if (name === 'fasting')      return <Svg {...p}><Circle cx={12} cy={12} r={10} /><Path d="M12 6v6l4 2" /></Svg>;
  if (name === 'period')       return <Svg {...p}><Path d="M12 22c5.5-4 10-8.5 10-13a10 10 0 0 0-20 0c0 4.5 4.5 9 10 13z" /></Svg>;
  if (name === 'healthrisk')   return <Svg {...p}><Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Svg>;
  if (name === 'recipe')       return <Svg {...p}><Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></Svg>;
  if (name === 'mealplan')     return <Svg {...p}><Rect x={3} y={4} width={18} height={18} rx={2} /><Line x1={3} y1={10} x2={21} y2={10} /><Line x1={8} y1={2} x2={8} y2={6} /><Line x1={16} y1={2} x2={16} y2={6} /><Line x1={8} y1={14} x2={16} y2={14} /></Svg>;
  if (name === 'transformation')return <Svg {...p}><Circle cx={12} cy={12} r={3} /><Path d="M6.5 6.5h11M6.5 17.5h11" /></Svg>;
  if (name === 'reminders')    return <Svg {...p}><Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.73 21a2 2 0 0 1-3.46 0" /></Svg>;
  if (name === 'nutrients')    return <Svg {...p}><Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Svg>;
  if (name === 'bmi')          return <Svg {...p}><Circle cx={12} cy={12} r={10} /><Line x1={2} y1={12} x2={22} y2={12} /><Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></Svg>;
  return null;
}

/* ── Flame logo from website ── */
function FlameLogo() {
  const { accentColor } = useTheme();
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M12.8324 21.8013C15.9583 21.1747 20 18.926 20 13.1112C20 7.8196 16.1267 4.29593 13.3415 2.67685C12.7235 2.31757 12 2.79006 12 3.50492V5.3334C12 6.77526 11.3938 9.40711 9.70932 10.5018C8.84932 11.0607 7.92052 10.2242 7.816 9.20388L7.73017 8.36604C7.6304 7.39203 6.63841 6.80075 5.85996 7.3946C4.46147 8.46144 3 10.3296 3 13.1112C3 20.2223 8.28889 22.0001 10.9333 22.0001C11.0871 22.0001 11.2488 21.9955 11.4171 21.9858C10.1113 21.8742 8 21.064 8 18.4442C8 16.3949 9.49507 15.0085 10.631 14.3346C10.9365 14.1533 11.2941 14.3887 11.2941 14.7439V15.3331C11.2941 15.784 11.4685 16.4889 11.8836 16.9714C12.3534 17.5174 13.0429 16.9454 13.0985 16.2273C13.1161 16.0008 13.3439 15.8564 13.5401 15.9711C14.1814 16.3459 15 17.1465 15 18.4442C15 20.4922 13.871 21.4343 12.8324 21.8013Z" fill={accentColor} />
    </Svg>
  );
}

/* ── Nav item ── */
function NavItem({ navKey, label, iconName, active, onPress, sub }) {
  const { mc, accentColor, accentDim } = useTheme();
  return (
    <TouchableOpacity
      style={[sb.item, active && { backgroundColor: accentDim }]}
      onPress={() => onPress(navKey)}
    >
      <View style={{ opacity: active ? 1 : 0.55 }}>
        <Icon name={iconName} color={active ? accentColor : mc.text2} />
      </View>
      <Text style={[sb.itemTxt, { color: mc.text2 }, active && { color: accentColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Sidebar — matches _sidebar.html exactly ── */
function Sidebar({ screen, navigate, username, onLogout, userGender }) {
  const { mc, accentColor, accentDim } = useTheme();
  return (
    <View style={[sb.sidebar, { backgroundColor: mc.sidebar, borderRightColor: mc.border }]}>
      {/* .sb-top */}
      <View style={sb.top}>
        <TouchableOpacity style={sb.brand} onPress={() => navigate('dashboard')}>
          <FlameLogo />
          <Text style={[sb.brandName, { color: mc.text }]}>Too Good</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[sb.newChatBtn, { borderColor: mc.border }]} onPress={() => navigate('ai')}>
          <Text style={sb.newChatTxt}>＋  New AI chat</Text>
        </TouchableOpacity>
      </View>

      {/* .sb-nav */}
      <ScrollView style={sb.nav} showsVerticalScrollIndicator={false}>

        {/* Navigation section */}
        <Text style={[sb.sectionLabel, { color: mc.text3 }]}>Navigation</Text>
        <NavItem navKey="dashboard" label="Dashboard" iconName="dashboard" active={screen === 'dashboard'} onPress={navigate} />
        <NavItem navKey="ai"        label="AI"         iconName="ai"        active={screen === 'ai'}        onPress={navigate} />
        <NavItem navKey="log"       label="Log Today"  iconName="log"       active={screen === 'log'}       onPress={navigate} />
        <NavItem navKey="adapt"     label="TG·Adapt"   iconName="adapt"     active={screen === 'adapt'}     onPress={navigate} />

        {/* Fitness section */}
        <Text style={[sb.sectionLabel, { marginTop: 12, color: mc.text3 }]}>Fitness</Text>
        <NavItem navKey="coach"    label="Coach"             iconName="coach"    active={screen === 'coach'}    onPress={navigate} />
        <NavItem navKey="exercise" label="Exercise Schedule" iconName="exercise" active={screen === 'exercise'} onPress={navigate} />
        <NavItem navKey="calendar" label="Calendar"          iconName="calendar" active={screen === 'calendar'} onPress={navigate} />
        <NavItem navKey="diary"    label="Daily Diary"       iconName="diary"    active={screen === 'diary'}    onPress={navigate} />
        {/* Score has a top separator */}
        <View style={sb.scoreSep} />
        <NavItem navKey="score"    label="Score"             iconName="score"    active={screen === 'score'}    onPress={navigate} />

        {/* Gym section */}
        <Text style={[sb.sectionLabel, { marginTop: 12, color: mc.text3 }]}>Gym</Text>
        <NavItem navKey="workout"         label="Workout Tracker"   iconName="workout"         active={screen === 'workout'}         onPress={navigate} />
        <NavItem navKey="guidedworkout"   label="Guided Workouts"   iconName="guidedworkout"   active={screen === 'guidedworkout'}   onPress={navigate} />
        <NavItem navKey="programs"        label="Programs & Plans"  iconName="programs"        active={screen === 'programs'}        onPress={navigate} />
        <NavItem navKey="hiittimer"       label="HIIT Timer"        iconName="hiittimer"       active={screen === 'hiittimer'}       onPress={navigate} />
        <NavItem navKey="exerciselibrary" label="Exercise Library"  iconName="exerciselibrary" active={screen === 'exerciselibrary'} onPress={navigate} />
        <NavItem navKey="gymprogress"     label="Gym Progress"      iconName="gymprogress"     active={screen === 'gymprogress'}     onPress={navigate} />
        <NavItem navKey="gymtools"        label="Gym Tools"         iconName="gymtools"        active={screen === 'gymtools'}        onPress={navigate} />

        {/* Compete section */}
        <Text style={[sb.sectionLabel, { marginTop: 12, color: mc.text3 }]}>Compete</Text>
        <NavItem navKey="challenges" label="Challenges" iconName="challenges" active={screen === 'challenges'} onPress={navigate} />
        <NavItem navKey="clubs"      label="Clubs"      iconName="clubs"      active={screen === 'clubs'}      onPress={navigate} />
        <NavItem navKey="segments"   label="Segments"   iconName="segments"   active={screen === 'segments'}   onPress={navigate} />

        {/* Social section */}
        <Text style={[sb.sectionLabel, { marginTop: 12, color: mc.text3 }]}>Social</Text>
        <NavItem navKey="socials" label="Socials"    iconName="socials" active={screen === 'socials'} onPress={navigate} />
        <NavItem navKey="profile" label="My Profile" iconName="profile" active={screen === 'profile'} onPress={navigate} />

        {/* Health section */}
        <Text style={[sb.sectionLabel, { marginTop: 12, color: mc.text3 }]}>Health</Text>
        <NavItem navKey="steps"          label="Step Tracker"     iconName="steps"          active={screen === 'steps'}          onPress={navigate} />
        <NavItem navKey="water"          label="Water Tracker"    iconName="water"          active={screen === 'water'}          onPress={navigate} />
        <NavItem navKey="sleep"          label="Sleep Tracker"    iconName="sleep"          active={screen === 'sleep'}          onPress={navigate} />
        <NavItem navKey="monitor"        label="Blood Monitor"    iconName="monitor"        active={screen === 'monitor'}        onPress={navigate} />
        <NavItem navKey="bmi"            label="BMI & Metrics"    iconName="bmi"            active={screen === 'bmi'}            onPress={navigate} />
        <NavItem navKey="healthrisk"     label="Health Risk"      iconName="healthrisk"     active={screen === 'healthrisk'}     onPress={navigate} />
        <NavItem navKey="reminders"      label="Reminders"        iconName="reminders"      active={screen === 'reminders'}      onPress={navigate} />
        {(userGender === 'female' || userGender === '') && (
          <NavItem navKey="period" label="Period Tracker" iconName="period" active={screen === 'period'} onPress={navigate} />
        )}

        {/* Nutrition section */}
        <Text style={[sb.sectionLabel, { marginTop: 12, color: mc.text3 }]}>Nutrition</Text>
        <NavItem navKey="nutrients"      label="Nutrients"        iconName="nutrients"      active={screen === 'nutrients'}      onPress={navigate} />
        <NavItem navKey="recipe"         label="Recipe Builder"   iconName="recipe"         active={screen === 'recipe'}         onPress={navigate} />
        <NavItem navKey="mealplan"       label="Meal Plan"        iconName="mealplan"       active={screen === 'mealplan'}       onPress={navigate} />
        <NavItem navKey="fasting"        label="Fasting Tracker"  iconName="fasting"        active={screen === 'fasting'}        onPress={navigate} />
        <NavItem navKey="transformation" label="Transformation"   iconName="transformation" active={screen === 'transformation'} onPress={navigate} />

        {/* Settings — outside sections, before .sb-bottom */}
        <View style={sb.settingsSep} />
        <NavItem navKey="settings" label="Settings" iconName="settings" active={screen === 'settings'} onPress={navigate} />
      </ScrollView>

      {/* .sb-bottom — profile */}
      <View style={[sb.bottom, { borderTopColor: mc.border }]}>
        <TouchableOpacity style={sb.profileBtn} onPress={() => navigate('profile')}>
          <View style={[sb.avatar, { backgroundColor: accentDim, borderColor: mc.borderH }]}>
            <Text style={[sb.avatarTxt, { color: accentColor }]}>{(username[0] || '?').toUpperCase()}</Text>
          </View>
          <Text style={[sb.profileName, { color: mc.text }]} numberOfLines={1}>{username}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ paddingHorizontal: 10, paddingVertical: 6 }} onPress={onLogout}>
          <Text style={{ fontSize: 11, color: mc.text3, fontFamily: "'Courier Prime', monospace", letterSpacing: 2 }}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  const [screen,      setScreen]      = useState('loading');
  const [username,    setUsername]    = useState('');
  const [userGender,  setUserGender]  = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  useEffect(() => {
    getToken().then(async t => {
      if (t) {
        const u = await getUser();
        setUsername(u || '');
        const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tg_screen') : null;
        setScreen(saved && SCREENS[saved] ? saved : 'dashboard');
        // Fetch gender for period tracker visibility
        try {
          const res = await fetch('http://localhost:5000/api/v1/me', {
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          });
          const d = await res.json();
          setUserGender((d.gender || '').toLowerCase());
        } catch {}
      } else {
        setScreen('login');
      }
    });
  }, []);

  function persistScreen(s) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('tg_screen', s);
    setScreen(s);
  }

  const navigation = {
    navigate: (s) => persistScreen(s),
    replace:  (s) => { if (s === 'login') { setUsername(''); sessionStorage && sessionStorage.removeItem('tg_screen'); } persistScreen(s); },
  };

  async function handleLoginSuccess(u)  { setUsername(u); persistScreen('dashboard'); }
  async function handleSignupSuccess(u) { setUsername(u); setScreen('onboarding'); }
  async function handleLogout() { await clearAuth(); setUsername(''); sessionStorage && sessionStorage.removeItem('tg_screen'); setScreen('login'); }

  if (screen === 'loading')    return <ThemeProvider username=""><View style={{ flex: 1, backgroundColor: C.bg }} /></ThemeProvider>;
  if (screen === 'login')      return <ThemeProvider username=""><LoginScreen navigation={{ ...navigation, onSuccess: handleLoginSuccess, onSignupSuccess: handleSignupSuccess }} /></ThemeProvider>;
  if (screen === 'onboarding') return <ThemeProvider username={username}><OnboardingScreen navigation={{ navigate: persistScreen }} /></ThemeProvider>;

  const Screen = SCREENS[screen] || DashboardScreen;

  return (
    <ThemeProvider username={username}>
      <View style={styles.root}>
        {/* Desktop: always-visible sidebar */}
        {!isMobile && (
          <Sidebar screen={screen} navigate={persistScreen} username={username} onLogout={handleLogout} userGender={userGender} />
        )}

        <View style={styles.content}>
          {/* Mobile top bar with hamburger */}
          {isMobile && (
            <View style={styles.topBar}>
              <TouchableOpacity onPress={() => setSidebarOpen(v => !v)} style={styles.hamburger}>
                <View style={styles.hLine} />
                <View style={styles.hLine} />
                <View style={styles.hLine} />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>Too Good</Text>
            </View>
          )}
          <Screen key={screen} navigation={navigation} />
        </View>

        {/* Mobile: overlay sidebar */}
        {isMobile && sidebarOpen && (
          <>
            <TouchableOpacity
              style={styles.overlay}
              onPress={() => setSidebarOpen(false)}
              activeOpacity={1}
            />
            <View style={styles.mobileSidebar}>
              <Sidebar
                screen={screen}
                navigate={(s) => { persistScreen(s); setSidebarOpen(false); }}
                username={username}
                onLogout={handleLogout}
                userGender={userGender}
              />
            </View>
          </>
        )}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, flexDirection: 'row', backgroundColor: C.bg },
  content:      { flex: 1, overflow: 'hidden', flexDirection: 'column' },
  topBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.sidebar },
  hamburger:    { padding: 6, gap: 4, justifyContent: 'center' },
  hLine:        { width: 20, height: 2, backgroundColor: C.text2, marginVertical: 2 },
  topBarTitle:  { fontFamily: "'Special Elite', monospace", fontSize: 15, color: C.text, letterSpacing: 1.5, marginLeft: 12 },
  overlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  mobileSidebar:{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 260, zIndex: 11 },
});

// Sidebar styles — mirrors _sidebar.html CSS exactly
const sb = StyleSheet.create({
  // var(--sw) = 260px, var(--sidebar) = #080808
  sidebar:     { width: 260, backgroundColor: C.sidebar, borderRightWidth: 1, borderRightColor: C.border, height: '100%', flexShrink: 0, flexDirection: 'column' },

  // .sb-top
  top:         { padding: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  brand:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  brandName:   { fontFamily: "'Special Elite', monospace", fontSize: 15, color: C.text, letterSpacing: 1.5 },

  // .new-chat-btn
  newChatBtn:  { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: C.border },
  newChatTxt:  { fontFamily: "'Courier Prime', monospace", fontSize: 13, color: C.text2, letterSpacing: 1.5 },

  // .sb-nav
  nav:         { flex: 1, paddingTop: 8, paddingBottom: 6 },

  // .sb-section-label
  sectionLabel:{ fontSize: 10, color: C.text3, letterSpacing: 6, textTransform: 'uppercase', fontFamily: "'Courier Prime', monospace", paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },

  // .sb-item
  item:        { flexDirection: 'row', alignItems: 'center', gap: 9, width: '100%', paddingVertical: 8, paddingHorizontal: 14 },
  itemActive:  { backgroundColor: 'rgba(201,168,76,0.09)' },
  itemTxt:     { fontSize: 13, color: C.text2, fontFamily: "'Courier Prime', monospace", letterSpacing: 0.5 },
  itemTxtActive:{ color: C.gold },

  // Score separator — border-top + margin
  scoreSep:    { height: 1, backgroundColor: C.border, marginHorizontal: 14, marginTop: 6, marginBottom: 6 },

  // Settings separator
  settingsSep: { height: 1, backgroundColor: C.border, marginHorizontal: 14, marginTop: 6, marginBottom: 6 },

  // .sb-bottom
  bottom:      { borderTopWidth: 1, borderTopColor: C.border, padding: 8 },
  profileBtn:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10 },
  avatar:      { width: 28, height: 28, backgroundColor: 'rgba(201,168,76,0.12)', borderWidth: 1, borderColor: C.borderH, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarTxt:   { fontFamily: "'Courier Prime', monospace", fontSize: 13, color: C.gold, fontWeight: '700' },
  profileName: { flex: 1, fontFamily: "'Courier Prime', monospace", fontSize: 14, color: C.text },
});
