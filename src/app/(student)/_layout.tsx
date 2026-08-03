import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useIsWideScreen } from '@/hooks/use-is-wide-screen';
import { useAuthStore } from '@/store/auth-store';

function tabIcon(name: keyof typeof Feather.glyphMap) {
  function TabBarIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} size={size} color={color as string} />;
  }
  return TabBarIcon;
}

export default function StudentLayout() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const isWide = useIsWideScreen();

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (profile?.role === 'teacher' || profile?.role === 'admin') {
    return <Redirect href="/(teacher)/dashboard" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarStyle: {
          display: isWide ? 'none' : 'flex',
          backgroundColor: '#14121F',
          borderTopColor: '#26233A',
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen
        name="my-classes"
        options={{ title: 'My Classes', tabBarIcon: tabIcon('book-open') }}
      />
      <Tabs.Screen name="todo" options={{ title: 'To-do', tabBarIcon: tabIcon('check-square') }} />
      <Tabs.Screen name="grades" options={{ title: 'Grades', tabBarIcon: tabIcon('award') }} />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: tabIcon('trending-up') }}
      />
      <Tabs.Screen name="assignments/index" options={{ href: null }} />
      <Tabs.Screen name="portfolio" options={{ href: null }} />
    </Tabs>
  );
}
