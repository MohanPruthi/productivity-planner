import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { accents, colors } from '@/constants/theme';

type FeatherName = keyof typeof Feather.glyphMap;

const featherIcon = (name: FeatherName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} size={size - 2} color={color as string} />;
  };

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarActiveTintColor: accents.today, tabBarIcon: featherIcon('sun') }}
      />
      <Tabs.Screen
        name="dsa"
        options={{ title: 'DSA', tabBarActiveTintColor: accents.dsa, tabBarIcon: featherIcon('code') }}
      />
      <Tabs.Screen
        name="notes"
        options={{ title: 'Notes', tabBarActiveTintColor: accents.notes, tabBarIcon: featherIcon('file-text') }}
      />
      <Tabs.Screen
        name="meds"
        options={{
          title: 'Meds',
          tabBarActiveTintColor: accents.meds,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="pill" size={size - 2} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarActiveTintColor: accents.settings, tabBarIcon: featherIcon('settings') }}
      />
    </Tabs>
  );
}
