import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../ThemeContext';
import HubTabs from '../components/HubTabs';
import RecipeScreen from './RecipeScreen';
import MealPlanScreen from './MealPlanScreen';

const TABS = [
  { key: 'recipe',   label: 'Recipe Builder' },
  { key: 'mealplan', label: 'Meal Plan' },
];

export default function MealPlanningScreen({ navigation }) {
  const { mc } = useTheme();
  const [tab, setTab] = useState('recipe');
  return (
    <View style={{ flex: 1, backgroundColor: mc.bg }}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>
        {tab === 'recipe'   && <RecipeScreen navigation={navigation} />}
        {tab === 'mealplan' && <MealPlanScreen navigation={navigation} />}
      </View>
    </View>
  );
}
