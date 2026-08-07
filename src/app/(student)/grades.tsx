import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentGradebookView } from '@/components/class/student-gradebook-view';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentClasses } from '@/hooks/queries/use-student-classes';

// The exact same spreadsheet-grid Gradebook a teacher sees for one student's row (see
// StudentGradebookView's own header comment) — surfaced here at the top level instead of only
// inside a specific class, so "my grades" doesn't require navigating into a class first. The
// class-picker below mirrors (teacher)/reports/index.tsx's pattern exactly, since both screens
// have the same shape: pick which class, then show that class's already-built dashboard/grid.
export default function StudentGradesScreen() {
  const classesQuery = useStudentClasses();
  const classes = classesQuery.data ?? [];
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const activeClassId = selectedClassId ?? classes[0]?.id ?? null;

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-paper">
        <View className="border-b border-black/5 bg-white px-6 py-5">
          <Text className="text-2xl font-bold text-ink">Grades</Text>
          <Text className="text-sm text-ink/50">
            Every mark your teacher has given you, plus the full breakdown behind each one.
          </Text>
        </View>

        {classesQuery.isLoading && <ActivityIndicator style={{ marginTop: 16 }} />}

        {!classesQuery.isLoading && classes.length === 0 && (
          <View className="items-center justify-center px-6 py-14">
            <Text className="text-sm text-ink/40">
              Join a class first — your grades show up here once you have one.
            </Text>
          </View>
        )}

        {classes.length > 1 && (
          <View className="flex-row flex-wrap gap-2 border-b border-black/5 bg-white px-6 py-3">
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
                  <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink/70'}`}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {activeClassId && <StudentGradebookView classId={activeClassId} />}
      </SafeAreaView>
    </StudentShell>
  );
}
