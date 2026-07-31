import { Redirect, Tabs } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';

export default function TeacherLayout() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (profile?.role === 'student') return <Redirect href="/(student)/home" />;

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2b5cf0' }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="assignments/index" options={{ title: 'Assignments' }} />
      <Tabs.Screen name="classes/index" options={{ title: 'Classes' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="reports/index" options={{ title: 'Reports' }} />
    </Tabs>
  );
}
