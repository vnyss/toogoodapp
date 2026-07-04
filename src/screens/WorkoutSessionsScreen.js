import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../ThemeContext';
import HubTabs from '../components/HubTabs';
import GuidedWorkoutScreen from './GuidedWorkoutScreen';
import HomeWorkoutScreen from './HomeWorkoutScreen';
import HIITTimerScreen from './HIITTimerScreen';

const TABS = [
  { key: 'guidedworkout', label: 'Guided' },
  { key: 'homeworkout',   label: 'Home' },
  { key: 'hiittimer',     label: 'HIIT Timer' },
];

export default function WorkoutSessionsScreen({ navigation }) {
  const { mc } = useTheme();
  const [tab, setTab] = useState('guidedworkout');
  return (
    <View style={{ flex: 1, backgroundColor: mc.bg }}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>
        {tab === 'guidedworkout' && <GuidedWorkoutScreen navigation={navigation} />}
        {tab === 'homeworkout'   && <HomeWorkoutScreen navigation={navigation} />}
        {tab === 'hiittimer'     && <HIITTimerScreen navigation={navigation} />}
      </View>
    </View>
  );
}
