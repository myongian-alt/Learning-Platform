import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { signOut } from '@/lib/auth-actions';
import { useAuthStore } from '@/store/auth-store';

function Spinner() {
  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </ThemedView>
  );
}

export default function Index() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  // isLoading false + a session but no profile means useAuthListener already tried (with
  // retries) and gave up — not "still loading" but an orphaned session (e.g. a stale token
  // in storage pointing at a deleted account). Previously this rendered the spinner forever
  // with no way out; sign out instead so the user lands back on sign-in.
  const isOrphanedSession = !isLoading && Boolean(session) && !profile;

  useEffect(() => {
    if (isOrphanedSession) signOut();
  }, [isOrphanedSession]);

  if (isLoading || isOrphanedSession) {
    return <Spinner />;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (profile && (profile.role === 'teacher' || profile.role === 'admin')) {
    return <Redirect href="/(teacher)/dashboard" />;
  }

  return <Redirect href="/(student)/home" />;
}
