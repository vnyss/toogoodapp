import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../ThemeContext';
import HubTabs from '../components/HubTabs';
import ChallengesScreen from './ChallengesScreen';
import ClubsScreen from './ClubsScreen';
import SegmentsScreen from './SegmentsScreen';

const TABS = [
  { key: 'challenges', label: 'Challenges' },
  { key: 'clubs',      label: 'Clubs' },
  { key: 'segments',   label: 'Segments' },
];

export default function CompeteScreen({ navigation }) {
  const { mc } = useTheme();
  const [tab, setTab] = useState('challenges');
  return (
    <View style={{ flex: 1, backgroundColor: mc.bg }}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>
        {tab === 'challenges' && <ChallengesScreen navigation={navigation} />}
        {tab === 'clubs'      && <ClubsScreen navigation={navigation} />}
        {tab === 'segments'   && <SegmentsScreen navigation={navigation} />}
      </View>
    </View>
  );
}
