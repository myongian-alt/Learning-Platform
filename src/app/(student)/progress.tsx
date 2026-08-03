import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentShell } from '@/components/layout/student-shell';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useStudentDashboard } from '@/hooks/queries/use-student-dashboard';

const CLASS_ACCENTS = ['#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

export default function StudentProgressScreen() {
  const dashboard = useStudentDashboard();
  const data = dashboard.data;
  const maxWeekly = Math.max(1, ...(data?.weeklyActivity.map((w) => w.count) ?? [1]));

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-lf-canvas">
        <ScrollView contentContainerClassName="gap-6 px-5 py-6 md:px-9" className="flex-1">
          <View className="mx-auto w-full max-w-4xl gap-6">
            <View>
              <Text className="text-3xl font-extrabold tracking-tight text-lf-ink">
                Your progress
              </Text>
              <Text className="text-base text-lf-muted">Keep the streak going.</Text>
            </View>

            {dashboard.isLoading && <ActivityIndicator />}

            <View className="flex-row flex-wrap gap-4">
              <View
                className="justify-center gap-1.5 rounded-3xl p-6"
                style={{ backgroundColor: '#F59E0B', minWidth: 220, flex: 1 }}
              >
                <Text className="text-xs font-bold tracking-wide text-white/80">
                  CURRENT STREAK
                </Text>
                <Text className="text-5xl font-extrabold tracking-tight text-white">
                  {data?.streak ?? 0}
                </Text>
                <Text className="text-sm font-semibold text-white/90">school days in a row</Text>
              </View>

              <View
                className="gap-3 rounded-3xl bg-white p-6 shadow-sm"
                style={{ minWidth: 260, flex: 1 }}
              >
                <Text className="text-[15px] font-extrabold text-lf-ink">Completion by class</Text>
                <View className="gap-3">
                  {(data?.classes ?? []).map((c, i) => (
                    <View key={c.id} className="gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[13px] font-bold text-lf-ink2" numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text className="text-[13px] font-bold text-lf-ink2">
                          {c.percentComplete}%
                        </Text>
                      </View>
                      <ProgressBar
                        percent={c.percentComplete}
                        color={CLASS_ACCENTS[i % CLASS_ACCENTS.length]}
                        height={8}
                      />
                    </View>
                  ))}
                  {(data?.classes.length ?? 0) === 0 && (
                    <Text className="text-sm text-lf-muted">
                      Join a class to see progress here.
                    </Text>
                  )}
                </View>
              </View>

              <View
                className="gap-3 rounded-3xl bg-white p-6 shadow-sm"
                style={{ minWidth: 260, flex: 1 }}
              >
                <Text className="text-[15px] font-extrabold text-lf-ink">Badges</Text>
                <View className="flex-row flex-wrap gap-3">
                  {(data?.badges ?? []).map((badge) => (
                    <View
                      key={badge.key}
                      className="items-center gap-1.5 rounded-2xl p-3"
                      style={{ backgroundColor: badge.earned ? '#F59E0B1A' : '#F7F5FB', width: 92 }}
                    >
                      <Feather
                        name="award"
                        size={20}
                        color={badge.earned ? '#F59E0B' : '#B4B0C4'}
                      />
                      <Text
                        className="leading-3.5 text-center text-[10.5px] font-bold"
                        style={{ color: badge.earned ? '#B45309' : '#B4B0C4' }}
                      >
                        {badge.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className="gap-4 rounded-3xl bg-white p-6 shadow-sm">
              <Text className="text-[15px] font-extrabold text-lf-ink">Activity, last 8 weeks</Text>
              <View className="flex-row items-end gap-2.5" style={{ height: 140 }}>
                {(data?.weeklyActivity ?? []).map((bucket, i) => {
                  const isCurrent = i === (data?.weeklyActivity.length ?? 1) - 1;
                  const heightPct = Math.max(6, (bucket.count / maxWeekly) * 100);
                  return (
                    <View
                      key={i}
                      className="flex-1 items-center justify-end gap-2"
                      style={{ height: '100%' }}
                    >
                      <View
                        className="w-full rounded-t-lg"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor: isCurrent ? '#7C3AED' : '#C4B5FD',
                        }}
                      />
                      <Text className="text-[10px] font-bold text-lf-muted4">W{bucket.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </StudentShell>
  );
}
