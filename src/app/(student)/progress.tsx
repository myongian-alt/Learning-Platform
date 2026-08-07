import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentShell } from '@/components/layout/student-shell';
import { useStudentDashboard } from '@/hooks/queries/use-student-dashboard';

// Same accent set as the teacher's own class cards (src/app/classes.tsx's CARD_ACCENTS).
const CLASS_ACCENTS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

export default function StudentProgressScreen() {
  const dashboard = useStudentDashboard();
  const data = dashboard.data;
  const maxWeekly = Math.max(1, ...(data?.weeklyActivity.map((w) => w.count) ?? [1]));

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-paper">
        <ScrollView className="flex-1" contentContainerClassName="pb-11">
          <View className="w-full max-w-[1180px] px-[34px] pt-[34px]" style={{ alignSelf: 'center' }}>
            <Text className="text-[30px] font-bold tracking-tighter text-ink">Your progress</Text>
            <Text className="mt-1.5 max-w-[52ch] text-[14.5px] leading-[1.5] text-ink/60">
              Keep the streak going.
            </Text>

            {dashboard.isLoading && <ActivityIndicator style={{ marginTop: 16 }} />}

            <View className="mt-6 flex-row flex-wrap gap-4">
              <View
                className="justify-center gap-1.5 rounded-2xl border border-black/15 bg-amber-50 p-6 shadow-sm"
                style={{ minWidth: 220, flex: 1 }}
              >
                <Text className="text-xs font-bold uppercase tracking-[0.1em] text-amber-800">
                  Current streak
                </Text>
                <Text className="text-5xl font-bold tracking-tighter text-amber-800">
                  {data?.streak ?? 0}
                </Text>
                <Text className="text-sm font-semibold text-amber-800">
                  school days in a row
                </Text>
              </View>

              <View
                className="gap-3 rounded-2xl border border-black/15 bg-white p-6 shadow-sm"
                style={{ minWidth: 260, flex: 1 }}
              >
                <Text className="text-[15px] font-bold tracking-tighter text-ink">
                  Completion by class
                </Text>
                <View className="gap-3">
                  {(data?.classes ?? []).map((c, i) => (
                    <View key={c.id} className="gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[13px] font-semibold text-ink/70" numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text className="text-[13px] font-semibold text-ink/70">
                          {c.percentComplete}%
                        </Text>
                      </View>
                      <View className="h-1 rounded-full bg-black/10">
                        <View
                          className="h-full rounded-full"
                          style={{
                            width: `${c.percentComplete}%`,
                            backgroundColor: CLASS_ACCENTS[i % CLASS_ACCENTS.length],
                          }}
                        />
                      </View>
                    </View>
                  ))}
                  {(data?.classes.length ?? 0) === 0 && (
                    <Text className="text-sm text-ink/50">Join a class to see progress here.</Text>
                  )}
                </View>
              </View>

              <View
                className="gap-3 rounded-2xl border border-black/15 bg-white p-6 shadow-sm"
                style={{ minWidth: 260, flex: 1 }}
              >
                <Text className="text-[15px] font-bold tracking-tighter text-ink">Badges</Text>
                <View className="flex-row flex-wrap gap-2.5">
                  {(data?.badges ?? []).map((badge) => (
                    <View
                      key={badge.key}
                      className="items-center gap-1.5 rounded-xl border border-black/15 px-3.5 py-3"
                      style={{ backgroundColor: badge.earned ? '#fef3c7' : '#f3f4f6', width: 92 }}
                    >
                      <Feather
                        name="award"
                        size={20}
                        color={badge.earned ? '#b45309' : '#9ca3af'}
                      />
                      <Text
                        className="max-w-[76px] text-center text-[10.5px] font-semibold"
                        style={{ color: badge.earned ? '#92400e' : '#9ca3af' }}
                      >
                        {badge.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className="mt-6 gap-4 rounded-2xl border border-black/15 bg-white p-6 shadow-sm">
              <Text className="text-[15px] font-bold tracking-tighter text-ink">
                Activity, last 8 weeks
              </Text>
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
                        className="w-full rounded-t"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor: isCurrent ? '#7c3aed' : '#c4b5fd',
                        }}
                      />
                      <Text className="text-[10px] font-bold text-ink/40">W{bucket.label}</Text>
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
