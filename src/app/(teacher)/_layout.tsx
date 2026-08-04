import { Feather } from '@expo/vector-icons';
import { Link, Redirect, Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/auth-store';

export default function TeacherLayout() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (profile?.role === 'student') return <Redirect href="/(student)/home" />;

  return (
    <View style={{ flex: 1 }}>
      {/* This tab group predates the LearnFlow sidebar shell and has no other way back to
          it — without this, a teacher who follows the sidebar's Assignments/Reports links
          lands here with no way out except the browser back button. */}
      <SafeAreaView edges={['top']} className="bg-paper">
        <Link href="/classes" asChild>
          <Pressable className="flex-row items-center gap-1.5 px-5 py-2.5">
            <Feather name="arrow-left" size={14} color="#2b5cf0" />
            <Text className="text-sm font-semibold text-brand-600">Back to Classes</Text>
          </Pressable>
        </Link>
      </SafeAreaView>
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2b5cf0' }}>
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="assignments/index" options={{ title: 'Assignments' }} />
        <Tabs.Screen name="library" options={{ title: 'Library' }} />
        <Tabs.Screen name="reports/index" options={{ title: 'Reports' }} />
      </Tabs>
    </View>
  );
}
