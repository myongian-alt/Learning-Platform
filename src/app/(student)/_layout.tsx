import { Redirect, Tabs } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';

export default function StudentLayout() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (profile?.role === 'teacher' || profile?.role === 'admin') {
    return <Redirect href="/(teacher)/dashboard" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2b5cf0' }}>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="assignments/index" options={{ title: 'Assignments' }} />
      <Tabs.Screen name="portfolio" options={{ title: 'Portfolio' }} />
    </Tabs>
  );
}
