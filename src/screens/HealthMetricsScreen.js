import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../ThemeContext';
import HubTabs from '../components/HubTabs';
import BMIScreen from './BMIScreen';
import HealthRiskScreen from './HealthRiskScreen';

const TABS = [
  { key: 'bmi',        label: 'BMI & Metrics' },
  { key: 'healthrisk', label: 'Health Risk' },
];

export default function HealthMetricsScreen({ navigation }) {
  const { mc } = useTheme();
  const [tab, setTab] = useState('bmi');
  return (
    <View style={{ flex: 1, backgroundColor: mc.bg }}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>
        {tab === 'bmi'        && <BMIScreen navigation={navigation} />}
        {tab === 'healthrisk' && <HealthRiskScreen navigation={navigation} />}
      </View>
    </View>
  );
}
