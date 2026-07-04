import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../ThemeContext';
import HubTabs from '../components/HubTabs';
import ExerciseScreen from './ExerciseScreen';
import CalendarScreen from './CalendarScreen';

const TABS = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'exercise', label: 'Exercise Schedule' },
];

export default function ScheduleScreen({ navigation }) {
  const { mc } = useTheme();
  const [tab, setTab] = useState('calendar');
  return (
    <View style={{ flex: 1, backgroundColor: mc.bg }}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>
        {tab === 'exercise' && <ExerciseScreen navigation={navigation} />}
        {tab === 'calendar' && <CalendarScreen navigation={navigation} />}
      </View>
    </View>
  );
}
