import { Link, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentShell } from '@/components/layout/student-shell';
import { useStudentDashboard } from '@/hooks/queries/use-student-dashboard';

// Same accent set as the teacher's own class cards (src/app/classes.tsx's CARD_ACCENTS).
const CLASS_ACCENTS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

export default function MyClassesScreen() {
  const dashboard = useStudentDashboard();
  const classes = dashboard.data?.classes ?? [];

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-paper">
        <ScrollView className="flex-1" contentContainerClassName="pb-11">
          <View className="w-full max-w-[1180px] px-[34px] pt-[34px]" style={{ alignSelf: 'center' }}>
            <Text className="text-[30px] font-bold tracking-tighter text-ink">My classes</Text>
            <Text className="mt-1.5 max-w-[52ch] text-[14.5px] leading-[1.5] text-ink/60">
              Every class you&apos;ve joined, and how you&apos;re doing in each.
            </Text>

            {dashboard.isLoading && <ActivityIndicator style={{ marginTop: 16 }} />}
            {!dashboard.isLoading && classes.length === 0 && (
              <Text className="mt-4 text-sm text-ink/50">
                You haven&apos;t joined a class yet — use the code your teacher gave you from the
                Home tab.
              </Text>
            )}

            <View className="mt-6 gap-2.5">
              {classes.map((c, i) => {
                const accent = CLASS_ACCENTS[i % CLASS_ACCENTS.length];
                const meta = [c.term, c.subject].filter(Boolean).join(' · ');
                return (
                  <Link key={c.id} href={`/class/${c.id}` as Href} asChild>
                    <Pressable
                      className="flex-row flex-wrap items-center gap-4.5 rounded-2xl border border-black/15 bg-white px-4 py-[15px] shadow-sm"
                      style={{ borderLeftColor: accent, borderLeftWidth: 4 }}
                    >
                      <Text className="w-[30px] text-[18px] font-bold text-ink/30">
                        {String(i + 1).padStart(2, '0')}
                      </Text>
                      <View className="flex-1" style={{ minWidth: 180 }}>
                        <Text className="text-base font-bold tracking-tighter text-ink">
                          {c.name}
                        </Text>
                        {meta.length > 0 && (
                          <Text className="mt-0.5 text-[13px] text-ink/50">{meta}</Text>
                        )}
                      </View>
                      <View
                        className="max-w-[160px] flex-1 flex-row items-center gap-2.5"
                        style={{ minWidth: 100 }}
                      >
                        <View className="h-1 flex-1 rounded-full bg-black/10">
                          <View
                            className="h-full rounded-full"
                            style={{ width: `${c.percentComplete}%`, backgroundColor: accent }}
                          />
                        </View>
                        <Text className="text-[12.5px] font-semibold text-ink/70">
                          {c.percentComplete}%
                        </Text>
                      </View>
                      <Text className="w-[92px] text-right text-[12.5px] text-ink/50">
                        {c.completedSlides} / {c.totalSlides} lessons
                      </Text>
                      <View
                        className="rounded-md bg-black/[0.03] px-2 py-1"
                        style={{ minWidth: 78 }}
                      >
                        <Text className="text-center text-[11px] font-semibold tracking-[0.08em] text-ink/50">
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
