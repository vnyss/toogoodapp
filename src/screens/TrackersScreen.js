import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../ThemeContext';
import HubTabs from '../components/HubTabs';
import StepTrackerScreen from './StepTrackerScreen';
import WaterTrackerScreen from './WaterTrackerScreen';
import SleepTrackerScreen from './SleepTrackerScreen';

const TABS = [
  { key: 'steps', label: 'Steps' },
  { key: 'water', label: 'Water' },
  { key: 'sleep', label: 'Sleep' },
];

export default function TrackersScreen({ navigation }) {
  const { mc } = useTheme();
  const [tab, setTab] = useState('steps');
  return (
    <View style={{ flex: 1, backgroundColor: mc.bg }}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>
        {tab === 'steps' && <StepTrackerScreen navigation={navigation} />}
        {tab === 'water' && <WaterTrackerScreen navigation={navigation} />}
        {tab === 'sleep' && <SleepTrackerScreen navigation={navigation} />}
      </View>
    </View>
  );
}
