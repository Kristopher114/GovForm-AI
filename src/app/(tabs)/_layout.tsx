import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocalization } from '@/context/LocalizationContext';

export default function TabLayout() {
  const { t } = useLocalization();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2182DE',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav_home'),
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="forms"
        options={{
          title: t('nav_forms'),
          tabBarIcon: ({ color }) => <Ionicons name="list-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav_settings'),
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
