import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TEACHER_SIDEBAR_ITEMS, TeacherSidebar } from '@/components/layout/teacher-sidebar';
import { useTeacherClasses, type ClassWithMemberCount } from '@/hooks/queries/use-teacher-classes';
import { signOut } from '@/lib/auth-actions';
import { useAuthStore } from '@/store/auth-store';

const CARD_ACCENTS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

type IconRef =
  | { set: 'feather'; name: keyof typeof Feather.glyphMap }
  | { set: 'ionicons'; name: keyof typeof Ionicons.glyphMap };

const SUBJECT_META: Record<string, { icon: IconRef; color: string }> = {
  Mathematics: { icon: { set: 'feather', name: 'hash' }, color: '#3b82f6' },
  English: { icon: { set: 'feather', name: 'book-open' }, color: '#ec4899' },
  Science: { icon: { set: 'ionicons', name: 'flask-outline' }, color: '#10b981' },
  Physics: { icon: { set: 'ionicons', name: 'planet-outline' }, color: '#8b5cf6' },
  Chemistry: { icon: { set: 'ionicons', name: 'flask-outline' }, color: '#f59e0b' },
  Biology: { icon: { set: 'ionicons', name: 'leaf-outline' }, color: '#059669' },
  History: { icon: { set: 'feather', name: 'clock' }, color: '#ef4444' },
  Geography: { icon: { set: 'feather', name: 'globe' }, color: '#06b6d4' },
};
const DEFAULT_SUBJECT_META: { icon: IconRef; color: string } = {
  icon: { set: 'feather', name: 'book' },
  color: '#6366f1',
};

function MetaIcon({ icon, size, color }: { icon: IconRef; size: number; color: string }) {
  return icon.set === 'feather' ? (
    <Feather name={icon.name} size={size} color={color} />
  ) : (
    <Ionicons name={icon.name} size={size} color={color} />
  );
}

// The teacher's landing page after sign-in (see src/app/index.tsx) and what the sidebar's
// "Classes" item opens from inside a class's Lessons screen — both paths land here so the
// experience of "see everything I've created, or start a new one" is always the same page.
export default function TeacherClassesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const { classesQuery } = useTeacherClasses();
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const [search, setSearch] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  const showFlash = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash((current) => (current === message ? null : current)), 2200);
  };

  const handleSidebarSelect = (key: string) => {
    if (key === 'classes') return;
    if (key === 'assignments') return router.push('/(teacher)/assignments');
    if (key === 'reports') return router.push('/(teacher)/reports');
    // Lessons/Quizzes/Gradebook/Students/Groups/Settings all live inside a specific class's
    // own sidebar-driven sections — there's no "current class" on this landing page, so jump
    // into the most recently created one as a reasonable default.
    if (classes.length === 0) {
      showFlash('Create a class first.');
      return;
    }
    router.push(`/class/${classes[0].id}`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) =>
      [c.name, c.term, c.grade, c.subject, ...(c.section ?? [])].filter(Boolean).some((field) => field!.toLowerCase().includes(q)),
    );
  }, [classes, search]);

  const totalStudents = classes.reduce((sum, c) => sum + (c.class_members?.[0]?.count ?? 0), 0);
  // "Active this term" has no strict definition in the data model (classes only store a
  // `term` label, not start/end dates) — approximated here as classes sharing the most
  // recently created class's term, a reasonable stand-in until terms are modeled properly.
  const currentTerm = classes[0]?.term ?? null;
  const activeThisTerm = currentTerm ? classes.filter((c) => c.term === currentTerm).length : 0;

  if (profile?.role === 'student') {
    return <Redirect href="/(student)/home" />;
  }

  return (
    <View className="flex-1 flex-row bg-paper" style={{ paddingTop: insets.top }}>
      <TeacherSidebar
        items={TEACHER_SIDEBAR_ITEMS}
        activeKey="classes"
        onSelect={handleSidebarSelect}
        teacherName={profile?.full_name ?? 'Teacher'}
        avatarUrl={profile?.avatar_url}
        onProfilePress={() => signOut()}
      />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 p-6">
        <View className="flex-row items-center">
          <View className="flex-1" />
          <View className="flex-row items-center gap-1">
            <Text className="text-2xl font-bold text-ink">Your Classes</Text>
            <Feather name="chevron-down" size={18} color="#6b7280" />
          </View>
          <View className="flex-1 items-end">
            <Pressable onPress={() => signOut()}>
              <Text className="text-sm font-medium text-ink/70">Sign out</Text>
            </Pressable>
          </View>
        </View>

        <Link href="/create-class" asChild>
          <Pressable>
            <LinearGradient
              colors={['#8b5cf6', '#3b82f6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' }}
            >
              <View className="h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <Feather name="plus" size={22} color="#fff" />
              </View>
              <Text style={{ textAlign: 'center', width: '100%' }} className="mt-3 text-2xl font-extrabold text-white">
                Create Your Class
              </Text>
              <Text style={{ textAlign: 'center', width: '100%' }} className="mt-1 text-sm text-white/90">
                Term, grade, section, and subject in a few taps
              </Text>
            </LinearGradient>
          </Pressable>
        </Link>

        <View className="flex-row justify-center gap-3">
          <StatCard icon={{ set: 'feather', name: 'grid' }} color="#3b82f6" label="Total Classes" value={classes.length} />
          <StatCard icon={{ set: 'feather', name: 'users' }} color="#8b5cf6" label="Total Students" value={totalStudents} />
          <StatCard icon={{ set: 'ionicons', name: 'sparkles' }} color="#10b981" label="Active This Term" value={activeThisTerm} />
        </View>

        <View className="gap-3">
          <Text className="text-center text-base font-semibold text-ink/90">Your Classes ({classes.length})</Text>
          <View className="flex-row items-center justify-center gap-2">
            <View className="h-10 flex-row items-center gap-2 rounded-xl border border-black/5 bg-white px-3 shadow-sm">
              <Feather name="search" size={14} color="#6b7280" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search"
                placeholderTextColor="#9ca3af"
                className="w-32 text-sm text-ink"
              />
            </View>
            <Pressable
              onPress={() => showFlash('Filters are coming soon.')}
              className="h-10 flex-row items-center gap-1.5 rounded-xl border border-black/5 bg-white px-3 shadow-sm"
            >
              <Feather name="sliders" size={14} color="#4b5563" />
              <Text className="text-sm font-medium text-ink/80">Filter</Text>
            </Pressable>
          </View>

          {classesQuery.isLoading && <ActivityIndicator />}
          {!classesQuery.isLoading && filtered.length === 0 && (
            <View className="items-center py-4">
              <Text className="text-center text-sm text-ink/60">
                {classes.length === 0 ? 'Create your first class above to get started.' : 'No classes match your search.'}
              </Text>
            </View>
          )}

          <View className="flex-row flex-wrap justify-center gap-4">
            {filtered.map((classRow, i) => (
              <ClassCard key={classRow.id} classRow={classRow} accent={CARD_ACCENTS[i % CARD_ACCENTS.length]} />
            ))}
          </View>
        </View>

        <View className="items-center gap-3 rounded-2xl bg-white p-5 shadow-sm">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-violet-50">
            <Ionicons name="people-outline" size={22} color="#7c3aed" />
          </View>
          <Text className="text-center text-sm text-ink/70">Create more classes to organize your teaching year.</Text>
        </View>
      </ScrollView>

      {flash && (
        <View className="absolute bottom-6 right-6 rounded-xl bg-ink px-4 py-3 shadow-lg">
          <Text className="text-sm font-medium text-white">{flash}</Text>
        </View>
      )}
    </View>
  );
}

function StatCard({ icon, color, label, value }: { icon: IconRef; color: string; label: string; value: number }) {
  return (
    <View className="w-[220px] items-center gap-2 rounded-2xl bg-white p-5 shadow-sm">
      <View style={{ backgroundColor: `${color}1a` }} className="h-11 w-11 items-center justify-center rounded-xl">
        <MetaIcon icon={icon} size={20} color={color} />
      </View>
      <Text className="text-center text-xs font-medium text-ink/70">{label}</Text>
      <Text className="text-center text-2xl font-bold text-ink">{value}</Text>
    </View>
  );
}

function ClassCard({ classRow, accent }: { classRow: ClassWithMemberCount; accent: string }) {
  const subjectMeta = (classRow.subject && SUBJECT_META[classRow.subject]) || DEFAULT_SUBJECT_META;
  const meta = [classRow.term, classRow.section?.length ? `Section ${classRow.section.join(', ')}` : null, classRow.subject]
    .filter(Boolean)
    .join('  •  ');

  return (
    <Link href={`/class/${classRow.id}`} asChild>
      <Pressable
        style={{ borderLeftColor: accent, borderLeftWidth: 4 }}
        className="w-[240px] items-center gap-3 rounded-2xl bg-white p-5 shadow-sm"
      >
        <View style={{ backgroundColor: `${subjectMeta.color}1a` }} className="h-11 w-11 items-center justify-center rounded-xl">
          <MetaIcon icon={subjectMeta.icon} size={18} color={subjectMeta.color} />
        </View>
        <Text className="text-center text-base font-bold text-ink">{classRow.grade ?? classRow.name}</Text>
        {meta.length > 0 && <Text className="text-center text-xs font-medium text-ink/60">{meta}</Text>}
        <View className="w-full items-center gap-1 rounded-xl bg-black/[0.03] py-2">
          <Text className="text-[11px] font-medium text-ink/60">Join code</Text>
          <Text className="rounded-md bg-brand-50 px-2.5 py-1 font-mono text-xs font-semibold text-brand-700">
            {classRow.join_code}
          </Text>
        </View>
        <View className="w-full items-center rounded-lg bg-violet-600 py-2">
          <Text className="text-sm font-semibold text-white">Open</Text>
        </View>
      </Pressable>
    </Link>
  );
}
