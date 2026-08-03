import { type Href, usePathname, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { STUDENT_SIDEBAR_ITEMS } from '@/components/layout/student-sidebar';
import { TeacherSidebar } from '@/components/layout/teacher-sidebar';
import { useIsWideScreen } from '@/hooks/use-is-wide-screen';
import { signOut } from '@/lib/auth-actions';
import { useAuthStore } from '@/store/auth-store';

const ROUTE_BY_KEY: Record<string, Href> = {
  home: '/(student)/home',
  'my-classes': '/(student)/my-classes',
  todo: '/(student)/todo',
  grades: '/(student)/grades',
  progress: '/(student)/progress',
};

const KEY_BY_PATH: Record<string, string> = {
  '/home': 'home',
  '/my-classes': 'my-classes',
  '/todo': 'todo',
  '/grades': 'grades',
  '/progress': 'progress',
};

// Wraps every top-level student screen. On wide viewports it shows the same
// persistent dark sidebar shell the teacher side uses (via the shared
// `TeacherSidebar` component); on narrow viewports it renders children as-is and
// leaves navigation to the bottom tab bar in `(student)/_layout.tsx`.
export function StudentShell({ children }: { children: ReactNode }) {
  const isWide = useIsWideScreen();
  const router = useRouter();
  const pathname = usePathname();
  const profile = useAuthStore((s) => s.profile);

  if (!isWide) return <>{children}</>;

  const activeKey = KEY_BY_PATH[pathname] ?? 'home';

  return (
    <View className="flex-1 flex-row bg-lf-canvas">
      <TeacherSidebar
        items={STUDENT_SIDEBAR_ITEMS}
        activeKey={activeKey}
        onSelect={(key) => router.push(ROUTE_BY_KEY[key] ?? ROUTE_BY_KEY.home)}
        teacherName={profile?.full_name ?? 'Student'}
        avatarUrl={profile?.avatar_url}
        onProfilePress={() => signOut()}
        roleLabel="Student"
      />
      <View className="flex-1">{children}</View>
    </View>
  );
}
