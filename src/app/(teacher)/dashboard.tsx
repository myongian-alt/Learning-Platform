import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTeacherAssignments } from '@/hooks/queries/use-teacher-assignments';
import { useTeacherClasses } from '@/hooks/queries/use-teacher-classes';
import { signOut } from '@/lib/auth-actions';
import { useAuthStore } from '@/store/auth-store';
import { StatCard } from '@/components/ui/stat-card';

export default function TeacherDashboardScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { classesQuery } = useTeacherClasses();
  const { data: assignments, isLoading } = useTeacherAssignments();

  const publishedCount = assignments?.filter((a) => a.status === 'published').length ?? 0;
  const openHelpRequests =
    assignments?.reduce((sum, a) => sum + (a.help_requests?.[0]?.count ?? 0), 0) ?? 0;
  const classes = classesQuery.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="gap-6 px-5 py-6" className="mx-auto w-full max-w-3xl">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-ink">
              Welcome, {profile?.full_name?.split(' ')[0]}
            </Text>
            <Text className="text-base text-ink/60">Here&apos;s your classroom at a glance.</Text>
          </View>
          <Text onPress={() => signOut()} className="text-sm text-ink/40">
            Sign out
          </Text>
        </View>

        <View className="flex-row gap-3">
          <StatCard label="Classes" value={classesQuery.data?.length ?? 0} />
          <StatCard label="Published" value={publishedCount} />
          <StatCard label="Help requests" value={openHelpRequests} accent={openHelpRequests > 0} />
        </View>

        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-ink">See students progress</Text>
            {classes[0] && (
              <Link href={`/class-progress/${classes[0].id}?demo=1`} className="text-sm text-brand-600">
                30-student demo
              </Link>
            )}
          </View>

          {classes.slice(0, 4).map((classRow) => {
            const liveResource = classRow.lesson_resources?.find((resource) => resource.is_live_session) ?? null;
            return (
            <View key={classRow.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-ink">{classRow.name}</Text>
                  <Text className="text-xs uppercase tracking-wide text-ink/40">
                    {classRow.class_members?.[0]?.count ?? 0} students enrolled
                  </Text>
                  <Text className="text-xs text-ink/55">
                    {liveResource ? `Live lesson: ${liveResource.title}` : 'No lesson is marked live yet.'}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  {liveResource ? (
                    <Link href={`/class-progress/${classRow.id}?resourceId=${liveResource.id}`} asChild>
                      <Pressable className="rounded-full bg-emerald-600 px-3 py-2">
                        <Text className="text-xs font-semibold text-white">Open live monitor</Text>
                      </Pressable>
                    </Link>
                  ) : (
                    <Link href={`/class/${classRow.id}`} asChild>
                      <Pressable className="rounded-full bg-emerald-600 px-3 py-2">
                        <Text className="text-xs font-semibold text-white">Choose live lesson</Text>
                      </Pressable>
                    </Link>
                  )}
                  <Link href={`/class-progress/${classRow.id}?demo=1`} asChild>
                    <Pressable className="rounded-full border border-ink/10 px-3 py-2">
                      <Text className="text-xs font-semibold text-ink/70">Preview demo</Text>
                    </Pressable>
                  </Link>
                </View>
              </View>
            </View>
          )})}

          {(classesQuery.data?.length ?? 0) === 0 && (
            <Text className="text-sm text-ink/50">
              Create a class first. The live progress monitor opens per class.
            </Text>
          )}
        </View>

        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-ink">Assignments</Text>
            <Link href="/(teacher)/assignments" className="text-sm text-brand-600">
              View all
            </Link>
          </View>

          {isLoading && <Text className="text-sm text-ink/50">Loading…</Text>}
          {!isLoading && (assignments?.length ?? 0) === 0 && (
            <Text className="text-sm text-ink/50">
              Nothing yet — create a class, then an assignment, to get a live view of student work.
            </Text>
          )}

          {assignments?.slice(0, 5).map((assignment) => (
            <Link key={assignment.id} href={`/live/${assignment.id}`} asChild>
              <Pressable className="flex-row items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-ink">{assignment.title}</Text>
                  <Text className="text-xs uppercase tracking-wide text-ink/40">
                    {assignment.classes?.name} · {assignment.status}
                  </Text>
                </View>
                <Text className="text-sm text-brand-600">Monitor live →</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
