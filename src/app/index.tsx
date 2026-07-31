import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/store/auth-store';

export default function Index() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  if (isLoading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!session || !profile) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (profile.role === 'teacher' || profile.role === 'admin') {
    return <Redirect href="/(teacher)/dashboard" />;
  }

  return <Redirect href="/(student)/home" />;
}
