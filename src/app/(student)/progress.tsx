import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentShell } from '@/components/layout/student-shell';
import { useStudentDashboard } from '@/hooks/queries/use-student-dashboard';

const CLASS_ACCENTS = ['#302BB8', '#4B45E0', '#8C8BF0', '#4B7BF5', '#2E6B57'];

export default function StudentProgressScreen() {
  const dashboard = useStudentDashboard();
  const data = dashboard.data;
  const maxWeekly = Math.max(1, ...(data?.weeklyActivity.map((w) => w.count) ?? [1]));

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-desk-canvas">
        <ScrollView className="flex-1" contentContainerClassName="pb-11">
          <View className="w-full max-w-[1180px] px-[34px] pt-[34px]" style={{ alignSelf: 'center' }}>
            <Text className="font-poppins-semibold text-[30px] tracking-tighter text-desk-body">
              Your progress
            </Text>
            <Text className="mt-1.5 max-w-[52ch] font-desk-sans text-[14.5px] leading-[1.5] text-desk-body2">
              Keep the streak going.
            </Text>

            {dashboard.isLoading && <ActivityIndicator style={{ marginTop: 16 }} />}

            <View className="mt-6 flex-row flex-wrap gap-4">
              <View
                className="justify-center gap-1.5 rounded bg-desk-amber p-6"
                style={{ minWidth: 220, flex: 1 }}
              >
                <Text className="font-desk-sans-bold text-xs uppercase tracking-[0.1em] text-desk-amberText">
                  Current streak
                </Text>
                <Text className="font-poppins-semibold text-5xl tracking-tighter text-desk-amberText">
                  {data?.streak ?? 0}
                </Text>
                <Text className="font-desk-sans-semibold text-sm text-desk-amberText">
                  school days in a row
                </Text>
              </View>

              <View
                className="gap-3 rounded border border-desk-hairline bg-desk-surface p-6"
                style={{ minWidth: 260, flex: 1 }}
              >
                <Text className="font-poppins-semibold text-[15px] tracking-tighter text-desk-body">
                  Completion by class
                </Text>
                <View className="gap-3">
                  {(data?.classes ?? []).map((c, i) => (
                    <View key={c.id} className="gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <Text
                          className="font-desk-sans-semibold text-[13px] text-desk-body2"
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                        <Text className="font-desk-sans-semibold text-[13px] text-desk-body2">
                          {c.percentComplete}%
                        </Text>
                      </View>
                      <View className="h-1 bg-desk-hairline">
                        <View
                          className="h-full"
                          style={{
                            width: `${c.percentComplete}%`,
                            backgroundColor: CLASS_ACCENTS[i % CLASS_ACCENTS.length],
                          }}
                        />
                      </View>
                    </View>
                  ))}
                  {(data?.classes.length ?? 0) === 0 && (
                    <Text className="font-desk-sans text-sm text-desk-muted3">
                      Join a class to see progress here.
                    </Text>
                  )}
                </View>
              </View>

              <View
                className="gap-3 rounded border border-desk-hairline bg-desk-surface p-6"
                style={{ minWidth: 260, flex: 1 }}
              >
                <Text className="font-poppins-semibold text-[15px] tracking-tighter text-desk-body">
                  Badges
                </Text>
                <View className="flex-row flex-wrap gap-2.5">
                  {(data?.badges ?? []).map((badge) => (
                    <View
                      key={badge.key}
                      className="items-center gap-1.5 rounded-xl px-3.5 py-3"
                      style={{ backgroundColor: badge.earned ? '#F7EAD9' : '#EDE8DF', width: 92 }}
                    >
                      <Feather
                        name="award"
                        size={20}
                        color={badge.earned ? '#C56A2B' : '#8F897D'}
                      />
                      <Text
                        className="max-w-[76px] text-center font-desk-sans-semibold text-[10.5px]"
                        style={{ color: badge.earned ? '#7A4415' : '#8F897D' }}
                      >
                        {badge.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className="mt-6 gap-4 rounded border border-desk-hairline bg-desk-surface p-6">
              <Text className="font-poppins-semibold text-[15px] tracking-tighter text-desk-body">
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
                          backgroundColor: isCurrent ? '#302BB8' : '#8C8BF0',
                        }}
                      />
                      <Text className="font-desk-sans-bold text-[10px] text-desk-muted3">
                        W{bucket.label}
                      </Text>
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
