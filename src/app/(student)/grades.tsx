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
  Marked: { bg: '#E7E5FA', fg: '#302BB8' },
  'Full marks': { bg: '#E3F1EA', fg: '#2E6B57' },
  Auto: { bg: '#FBF0DC', fg: '#8A5A12' },
  Pending: { bg: '#EDE8DF', fg: '#8F897D' },
};

function ringColor(percent: number | null) {
  if (percent === null) return '#DDD6C8';
  if (percent >= 90) return '#2E6B57';
  if (percent >= 70) return '#302BB8';
  return '#E8B04B';
}

export default function StudentGradesScreen() {
  const { data, isLoading } = useStudentGrades();
  const items = data ?? [];
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected: GradedItem | undefined = items.find((i) => i.key === selectedKey) ?? items[0];

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-desk-canvas">
        <ScrollView className="flex-1" contentContainerClassName="pb-11">
          <View className="w-full max-w-[1180px] px-[34px] pt-[34px]" style={{ alignSelf: 'center' }}>
            <Text className="font-poppins-semibold text-[30px] tracking-tighter text-desk-body">
              Grades &amp; feedback
            </Text>
            <Text className="mt-1.5 max-w-[52ch] font-desk-sans text-[14.5px] leading-[1.5] text-desk-body2">
              Everything your teachers have looked at, with their marks and comments.
            </Text>

            {isLoading && <ActivityIndicator style={{ marginTop: 16 }} />}
            {!isLoading && items.length === 0 && (
              <Text className="mt-4 font-desk-sans text-sm text-desk-muted3">
                Nothing graded yet.
              </Text>
            )}

            <View className="mt-6 flex-row flex-wrap items-start gap-5">
              <View className="gap-2.5" style={{ minWidth: 300, flex: 1 }}>
                {items.map((item) => {
                  const tag = TAG_COLORS[item.tag];
                  const ring = ringColor(item.percent);
                  const isSelected = selected?.key === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setSelectedKey(item.key)}
                      className="flex-row items-center gap-3.5 rounded bg-desk-surface p-3.5"
                      style={{ borderWidth: 1.5, borderColor: isSelected ? '#302BB8' : '#DDD6C8' }}
                    >
                      <View
                        className="h-11 w-11 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${ring}22`, borderWidth: 2, borderColor: ring }}
                      >
                        <Text className="font-desk-sans-bold text-[11px] text-desk-body">
                          {item.percent !== null ? `${item.percent}%` : '—'}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text
                          className="font-desk-sans-semibold text-[14.5px] text-desk-body"
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text className="font-desk-sans text-xs text-desk-muted3">{item.meta}</Text>
                      </View>
                      <View className="rounded px-2 py-1" style={{ backgroundColor: tag.bg }}>
                        <Text
                          className="font-desk-sans-bold text-[10.5px]"
                          style={{ color: tag.fg }}
                        >
                          {item.tag}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {selected && (
                <View
                  className="gap-5 rounded border border-desk-hairline bg-desk-surface p-6"
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
                      <Text className="font-poppins-semibold text-lg text-desk-body">
                        {selected.scoreLabel}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-poppins-semibold text-lg tracking-tighter text-desk-body">
                        {selected.title}
                      </Text>
                      <Text className="font-desk-sans text-xs text-desk-muted3">
                        {selected.meta}
                      </Text>
                    </View>
                  </View>

                  {selected.detail && (
                    <View className="gap-2">
                      <Text className="font-desk-sans-bold text-[11px] uppercase tracking-[0.12em] text-desk-muted3">
                        Auto-graded breakdown
                      </Text>
                      <Text className="font-desk-sans-semibold text-sm text-desk-body">
                        {selected.detail.correct} of {selected.detail.total} questions correct
                      </Text>
                    </View>
                  )}

                  <View className="gap-2">
                    <Text className="font-desk-sans-bold text-[11px] uppercase tracking-[0.12em] text-desk-muted3">
                      Teacher comment
                    </Text>
                    {selected.feedback ? (
                      <View className="flex-row gap-3 rounded bg-desk-indigoTint p-4">
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-desk-indigo">
                          <Feather name="user" size={13} color="#fff" />
                        </View>
                        <Text className="flex-1 font-desk-sans text-sm leading-5 text-desk-body2">
                          {selected.feedback}
                        </Text>
                      </View>
                    ) : (
                      <Text className="font-desk-sans text-sm text-desk-muted3">
                        No comment left on this one.
                      </Text>
                    )}
                  </View>

                  <Link href={selected.href} asChild>
                    <Pressable className="mt-1 flex-row items-center gap-2 self-start rounded bg-desk-amber px-5 py-3">
                      <Text className="font-poppins-semibold text-sm text-desk-amberText">
                        Open
                      </Text>
                      <Feather name="arrow-right" size={14} color="#1A1200" />
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
