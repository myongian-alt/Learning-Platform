import { type Href, usePathname, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { STUDENT_SIDEBAR_ITEMS } from '@/components/layout/student-sidebar';
import { TeacherSidebar } from '@/components/layout/teacher-sidebar';
import { useIsWideScreen } from '@/hooks/use-is-wide-screen';
import { useStudentDashboard } from '@/hooks/queries/use-student-dashboard';
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

// Wraps every top-level student screen. On wide viewports it shows the same persistent
// sidebar shell the teacher side uses (`TeacherSidebar`, also shared by the per-class
// `StudentClassView`) — this used to be a separate `DeskSidebar` with its own dark/amber
// palette, but the "Enrolled classes" and streak widgets it carried are already shown in
// full on My Classes and Progress, so nothing is lost by using the same nav shell as
// everywhere else. On narrow viewports it renders children as-is and leaves navigation to
// the bottom tab bar in `(student)/_layout.tsx`.
export function StudentShell({ children }: { children: ReactNode }) {
  const isWide = useIsWideScreen();
  const router = useRouter();
  const pathname = usePathname();
  const profile = useAuthStore((s) => s.profile);
  const dashboard = useStudentDashboard();

  if (!isWide) return <>{children}</>;

  const activeKey = KEY_BY_PATH[pathname] ?? 'home';

  return (
    <View className="flex-1 flex-row bg-paper">
      <TeacherSidebar
        items={STUDENT_SIDEBAR_ITEMS}
        activeKey={activeKey}
        onSelect={(key) => router.push(ROUTE_BY_KEY[key] ?? ROUTE_BY_KEY.home)}
        teacherName={profile?.full_name ?? 'Student'}
        avatarUrl={profile?.avatar_url}
        roleLabel="Student"
        badges={{ todo: dashboard.data?.dueSoon.length ?? 0 }}
        onProfilePress={() => signOut()}
      />
      <View className="flex-1">{children}</View>
    </View>
  );
}
