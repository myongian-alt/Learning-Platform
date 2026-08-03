import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentShell } from '@/components/layout/student-shell';
import {
  useStudentGrades,
  type GradeTag,
  type GradedItem,
} from '@/hooks/queries/use-student-grades';

const TAG_COLORS: Record<GradeTag, { bg: string; fg: string }> = {
  Marked: { bg: '#EDE9FE', fg: '#5B21B6' },
  'Full marks': { bg: '#DCFCE7', fg: '#047857' },
  Auto: { bg: '#DBEAFE', fg: '#1D4ED8' },
  Pending: { bg: '#F5F3FA', fg: '#8A86A3' },
};

function ringColor(percent: number | null) {
  if (percent === null) return '#D5D0E2';
  if (percent >= 90) return '#10B981';
  if (percent >= 70) return '#7C3AED';
  return '#F59E0B';
}

export default function StudentGradesScreen() {
  const { data, isLoading } = useStudentGrades();
  const items = data ?? [];
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected: GradedItem | undefined = items.find((i) => i.key === selectedKey) ?? items[0];

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-lf-canvas">
        <ScrollView contentContainerClassName="gap-6 px-5 py-6 md:px-9" className="flex-1">
          <View className="mx-auto w-full max-w-5xl gap-6">
            <View>
              <Text className="text-3xl font-extrabold tracking-tight text-lf-ink">
                Grades &amp; feedback
              </Text>
              <Text className="text-base text-lf-muted">
                Everything your teachers have looked at, with their marks and comments.
              </Text>
            </View>

            {isLoading && <ActivityIndicator />}
            {!isLoading && items.length === 0 && (
              <Text className="text-sm text-lf-muted">Nothing graded yet.</Text>
            )}

            <View className="flex-row flex-wrap items-start gap-5">
              <View className="gap-2.5" style={{ minWidth: 300, flex: 1 }}>
                {items.map((item) => {
                  const tag = TAG_COLORS[item.tag];
                  const ring = ringColor(item.percent);
                  const isSelected = selected?.key === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setSelectedKey(item.key)}
                      className="flex-row items-center gap-3.5 rounded-2xl bg-white p-3.5"
                      style={{ borderWidth: 2, borderColor: isSelected ? '#7C3AED' : '#EDEAF4' }}
                    >
                      <View
                        className="h-11 w-11 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${ring}22`, borderWidth: 2, borderColor: ring }}
                      >
                        <Text className="text-[11px] font-extrabold text-lf-ink">
                          {item.percent !== null ? `${item.percent}%` : '—'}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-[14.5px] font-bold text-lf-ink" numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text className="text-xs text-lf-muted">{item.meta}</Text>
                      </View>
                      <View className="rounded-lg px-2 py-1" style={{ backgroundColor: tag.bg }}>
                        <Text className="text-[10.5px] font-bold" style={{ color: tag.fg }}>
                          {item.tag}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {selected && (
                <View
                  className="gap-5 rounded-3xl bg-white p-6 shadow-sm"
                  style={{ minWidth: 300, flex: 1 }}
                >
                  <View className="flex-row items-center gap-4">
                    <View
                      className="h-[70px] w-[70px] items-center justify-center rounded-full"
                      style={{
                        backgroundColor: `${ringColor(selected.percent)}22`,
                        borderWidth: 3,
                        borderColor: ringColor(selected.percent),
                      }}
                    >
                      <Text className="text-lg font-extrabold text-lf-ink">
                        {selected.scoreLabel}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-lg font-extrabold text-lf-ink">{selected.title}</Text>
                      <Text className="text-xs text-lf-muted">{selected.meta}</Text>
                    </View>
                  </View>

                  {selected.detail && (
                    <View className="gap-2">
                      <Text className="text-xs font-bold uppercase tracking-wide text-lf-muted3">
                        Auto-graded breakdown
                      </Text>
                      <Text className="text-sm font-semibold text-lf-ink2">
                        {selected.detail.correct} of {selected.detail.total} questions correct
                      </Text>
                    </View>
                  )}

                  <View className="gap-2">
                    <Text className="text-xs font-bold uppercase tracking-wide text-lf-muted3">
                      Teacher comment
                    </Text>
                    {selected.feedback ? (
                      <View className="flex-row gap-3 rounded-2xl bg-lf-purpleTint p-4">
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-lf-primary">
                          <Feather name="user" size={13} color="#fff" />
                        </View>
                        <Text className="flex-1 text-sm leading-5 text-lf-ink2">
                          {selected.feedback}
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-sm text-lf-muted">No comment left on this one.</Text>
                    )}
                  </View>

                  <Link href={selected.href} asChild>
                    <Pressable className="mt-1 flex-row items-center gap-2 self-start rounded-full bg-lf-primary px-5 py-3">
                      <Text className="text-sm font-extrabold text-white">Open</Text>
                      <Feather name="arrow-right" size={14} color="#fff" />
                    </Pressable>
                  </Link>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </StudentShell>
  );
}
