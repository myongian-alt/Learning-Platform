import { Link, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentShell } from '@/components/layout/student-shell';
import { useStudentDashboard } from '@/hooks/queries/use-student-dashboard';

const CLASS_RULE_COLORS = ['#302BB8', '#4B45E0', '#8C8BF0', '#4B7BF5', '#2E6B57'];

export default function MyClassesScreen() {
  const dashboard = useStudentDashboard();
  const classes = dashboard.data?.classes ?? [];

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-desk-canvas">
        <ScrollView className="flex-1" contentContainerClassName="pb-11">
          <View className="w-full max-w-[1180px] px-[34px] pt-[34px]" style={{ alignSelf: 'center' }}>
            <Text className="font-poppins-semibold text-[30px] tracking-tighter text-desk-body">
              My classes
            </Text>
            <Text className="mt-1.5 max-w-[52ch] font-desk-sans text-[14.5px] leading-[1.5] text-desk-body2">
              Every class you&apos;ve joined, and how you&apos;re doing in each.
            </Text>

            {dashboard.isLoading && <ActivityIndicator style={{ marginTop: 16 }} />}
            {!dashboard.isLoading && classes.length === 0 && (
              <Text className="mt-4 font-desk-sans text-sm text-desk-muted3">
                You haven&apos;t joined a class yet — use the code your teacher gave you from the
                Desk tab.
              </Text>
            )}

            <View className="mt-6">
              {classes.map((c, i) => {
                const ruleColor = CLASS_RULE_COLORS[i % CLASS_RULE_COLORS.length];
                const meta = [c.term, c.subject].filter(Boolean).join(' · ');
                return (
                  <Link key={c.id} href={`/class/${c.id}` as Href} asChild>
                    <Pressable
                      className="flex-row flex-wrap items-center gap-4.5 px-0.5 py-[15px]"
                      style={{
                        borderTopWidth: 1.5,
                        borderTopColor: ruleColor,
                        borderBottomWidth: i === classes.length - 1 ? 1.5 : 0,
                        borderBottomColor: ruleColor,
                      }}
                    >
                      <Text className="w-[30px] font-poppins-semibold text-[18px] text-desk-indigo">
                        {String(i + 1).padStart(2, '0')}
                      </Text>
                      <View className="flex-1" style={{ minWidth: 180 }}>
                        <Text className="font-poppins-medium text-base tracking-tighter text-desk-body">
                          {c.name}
                        </Text>
                        {meta.length > 0 && (
                          <Text className="mt-0.5 font-desk-sans text-[13px] text-desk-muted3">
                            {meta}
                          </Text>
                        )}
                      </View>
                      <View
                        className="max-w-[160px] flex-1 flex-row items-center gap-2.5"
                        style={{ minWidth: 100 }}
                      >
                        <View className="h-1 flex-1 bg-desk-hairline">
                          <View
                            className="h-full"
                            style={{ width: `${c.percentComplete}%`, backgroundColor: ruleColor }}
                          />
                        </View>
                        <Text className="font-desk-sans-semibold text-[12.5px] text-desk-body2">
                          {c.percentComplete}%
                        </Text>
                      </View>
                      <Text className="w-[92px] text-right font-desk-sans text-[12.5px] text-desk-muted3">
                        {c.completedSlides} / {c.totalSlides} lessons
                      </Text>
                      <View
                        className="rounded border border-desk-hairline px-2 py-1"
                        style={{ minWidth: 78 }}
                      >
                        <Text className="text-center font-desk-sans-semibold text-[11px] tracking-[0.08em] text-desk-muted3">
                          {c.join_code}
                        </Text>
                      </View>
                    </Pressable>
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
