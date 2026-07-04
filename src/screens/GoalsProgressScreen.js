import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../ThemeContext';
import HubTabs from '../components/HubTabs';
import SmartTargetsScreen from './SmartTargetsScreen';
import TransformationScreen from './TransformationScreen';

const TABS = [
  { key: 'smarttargets',   label: 'Smart Targets' },
  { key: 'transformation', label: 'Transformation' },
];

export default function GoalsProgressScreen({ navigation }) {
  const { mc } = useTheme();
  const [tab, setTab] = useState('smarttargets');
  return (
    <View style={{ flex: 1, backgroundColor: mc.bg }}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>
        {tab === 'smarttargets'   && <SmartTargetsScreen navigation={navigation} />}
        {tab === 'transformation' && <TransformationScreen navigation={navigation} />}
      </View>
    </View>
  );
}
