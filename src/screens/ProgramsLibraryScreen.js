import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../ThemeContext';
import HubTabs from '../components/HubTabs';
import WorkoutProgramsScreen from './WorkoutProgramsScreen';
import ExerciseLibraryScreen from './ExerciseLibraryScreen';

const TABS = [
  { key: 'programs',        label: 'Programs & Plans' },
  { key: 'exerciselibrary', label: 'Exercise Library' },
];

export default function ProgramsLibraryScreen({ navigation }) {
  const { mc } = useTheme();
  const [tab, setTab] = useState('programs');
  return (
    <View style={{ flex: 1, backgroundColor: mc.bg }}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>
        {tab === 'programs'        && <WorkoutProgramsScreen navigation={navigation} />}
        {tab === 'exerciselibrary' && <ExerciseLibraryScreen navigation={navigation} />}
      </View>
    </View>
  );
}
