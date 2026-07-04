import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';

// Tab switcher used by merged "hub" screens that combine 2-3 related
// screens behind a single sidebar entry.
export default function HubTabs({ tabs, active, onChange }) {
  const { mc, accentColor } = useTheme();
  return (
    <View style={s.row}>
      {tabs.map(t => {
        const isActive = t.key === active;
        return (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, { borderColor: mc.border }, isActive && { borderColor: accentColor, backgroundColor: accentColor + '18' }]}
            onPress={() => onChange(t.key)}
          >
            <Text style={[s.tabTxt, { color: mc.text2 }, isActive && { color: accentColor }]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  tab:    { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  tabTxt: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
});
