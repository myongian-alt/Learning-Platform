import { Link, type Href } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentShell } from '@/components/layout/student-shell';
import { PressableCard } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useStudentDashboard } from '@/hooks/queries/use-student-dashboard';

const ACCENTS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];

export default function MyClassesScreen() {
  const dashboard = useStudentDashboard();
  const classes = dashboard.data?.classes ?? [];

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-lf-canvas">
        <ScrollView contentContainerClassName="gap-6 px-5 py-6 md:px-9" className="flex-1">
          <View className="mx-auto w-full max-w-4xl gap-6">
            <View>
              <Text className="text-3xl font-extrabold tracking-tight text-lf-ink">My Classes</Text>
              <Text className="text-base text-lf-muted">
                Every class you&apos;ve joined, and how you&apos;re doing in each.
              </Text>
            </View>

            {dashboard.isLoading && <ActivityIndicator />}
            {!dashboard.isLoading && classes.length === 0 && (
              <Text className="text-sm text-lf-muted">
                You haven&apos;t joined a class yet — use the code your teacher gave you from the
                Home tab.
              </Text>
            )}

            <View className="flex-row flex-wrap gap-4">
              {classes.map((classRow, i) => {
                const accent = ACCENTS[i % ACCENTS.length];
                const meta = [classRow.term, classRow.subject].filter(Boolean).join(' · ');
                return (
                  <Link key={classRow.id} href={`/class/${classRow.id}` as Href} asChild>
                    <PressableCard
                      accentColor={accent}
                      padding="lg"
                      className="gap-3"
                      style={{ minWidth: 260, flexBasis: 260 }}
                    >
                      <Text className="text-lg font-extrabold text-lf-ink">{classRow.name}</Text>
                      {meta.length > 0 && (
                        <Text className="text-xs font-semibold text-lf-muted">{meta}</Text>
                      )}
                      <ProgressBar percent={classRow.percentComplete} color={accent} />
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-bold text-lf-muted2">
                          {classRow.percentComplete}% of term
                        </Text>
                        <View
                          className="rounded-md px-2 py-1"
                          style={{ backgroundColor: '#F5F3FA' }}
                        >
                          <Text className="text-[11px] font-bold tracking-wide text-lf-muted3">
                            {classRow.join_code}
                          </Text>
                        </View>
                      </View>
                      <View className="w-full items-center rounded-xl bg-lf-primary py-2.5">
                        <Text className="text-sm font-bold text-white">Open</Text>
                      </View>
                    </PressableCard>
                  </Link>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </StudentShell>
  );
}
