import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStudentAssignments } from '@/hooks/queries/use-student-assignments';

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  graded: 'Graded',
};

export default function StudentAssignmentsScreen() {
  const { data: assignments, isLoading } = useStudentAssignments();

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="gap-4 px-5 py-6" className="mx-auto w-full max-w-2xl">
        <Text className="text-2xl font-bold text-ink">Assignments</Text>

        {isLoading && <Text className="text-sm text-ink/50">Loading…</Text>}
        {!isLoading && (assignments?.length ?? 0) === 0 && (
          <Text className="text-sm text-ink/50">No assignments yet.</Text>
        )}

        {assignments?.map((assignment) => {
          const status = assignment.submission?.status ?? 'not_started';
          return (
            <Link key={assignment.id} href={`/canvas/${assignment.id}`} asChild>
              <Pressable className="gap-2 rounded-2xl bg-white p-4 shadow-sm">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-base font-semibold text-ink">
                    {assignment.title}
                  </Text>
                  <View className="rounded-full bg-brand-50 px-3 py-1">
                    <Text className="text-xs font-medium text-brand-700">
                      {STATUS_LABEL[status]}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-ink/50">{assignment.class_name}</Text>
                {assignment.due_at && (
                  <Text className="text-xs text-ink/40">
                    Due {new Date(assignment.due_at).toLocaleDateString()}
                  </Text>
                )}
              </Pressable>
            </Link>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
