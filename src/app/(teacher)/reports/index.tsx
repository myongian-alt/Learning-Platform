import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClassReportsDashboard } from '@/components/reports/class-reports-dashboard';
import { useTeacherClasses } from '@/hooks/queries/use-teacher-classes';

export default function ReportsScreen() {
  const { classesQuery } = useTeacherClasses();
  const classes = classesQuery.data ?? [];
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const activeClassId = selectedClassId ?? classes[0]?.id ?? null;

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="gap-6 px-6 py-6" className="flex-1">
        <View className="mx-auto w-full max-w-6xl gap-6">
          <View>
            <Text className="text-2xl font-bold text-ink">Reports</Text>
            <Text className="text-sm text-ink/50">
              Holistic, live analytics for whichever class you pick below.
            </Text>
          </View>

          {classesQuery.isLoading && <ActivityIndicator />}

          {!classesQuery.isLoading && classes.length === 0 && (
            <View className="items-center justify-center rounded-2xl border border-dashed border-black/10 py-14">
              <Text className="text-sm text-ink/40">
                Create a class first — reports show up here once you have one.
              </Text>
            </View>
          )}

          {classes.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {classes.map((c) => {
                const active = c.id === activeClassId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setSelectedClassId(c.id)}
                    className={`rounded-full border px-4 py-2 ${
                      active ? 'border-violet-600 bg-violet-600' : 'border-black/10 bg-white'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink/70'}`}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {activeClassId && <ClassReportsDashboard classId={activeClassId} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
