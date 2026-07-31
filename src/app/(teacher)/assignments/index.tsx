import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useCreateAssignment } from '@/hooks/queries/use-create-assignment';
import { useTeacherAssignments } from '@/hooks/queries/use-teacher-assignments';
import { useTeacherClasses } from '@/hooks/queries/use-teacher-classes';
import { useToggleAssignmentStatus } from '@/hooks/queries/use-toggle-assignment-status';

export default function TeacherAssignmentsScreen() {
  const { classesQuery } = useTeacherClasses();
  const { data: assignments, isLoading } = useTeacherAssignments();
  const createAssignment = useCreateAssignment();
  const toggleStatus = useToggleAssignmentStatus();

  const [title, setTitle] = useState('');
  const firstClass = classesQuery.data?.[0];

  const handleCreate = () => {
    if (!title.trim() || !firstClass) return;
    createAssignment.mutate({ classId: firstClass.id, title: title.trim() });
    setTitle('');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="gap-6 px-5 py-6" className="mx-auto w-full max-w-2xl">
        <Text className="text-2xl font-bold text-ink">Assignments</Text>

        {!firstClass && !classesQuery.isLoading && (
          <View className="rounded-2xl bg-amber-100 p-4">
            <Text className="text-sm text-amber-900">
              Create a class first (Classes tab) before assigning work.
            </Text>
          </View>
        )}

        {firstClass && (
          <View className="flex-row items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <View className="flex-1">
              <TextField
                label={`New assignment in ${firstClass.name}`}
                value={title}
                onChangeText={setTitle}
                placeholder="Cell structure warm-up"
              />
            </View>
            <Button
              label="Create"
              onPress={handleCreate}
              isLoading={createAssignment.isPending}
              variant="secondary"
            />
          </View>
        )}

        <View className="gap-3">
          {isLoading && <Text className="text-sm text-ink/50">Loading…</Text>}
          {assignments?.map((assignment) => (
            <View key={assignment.id} className="gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-base font-semibold text-ink">{assignment.title}</Text>
                <View
                  className={`rounded-full px-3 py-1 ${
                    assignment.status === 'published' ? 'bg-emerald-100' : 'bg-black/5'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      assignment.status === 'published' ? 'text-emerald-700' : 'text-ink/50'
                    }`}
                  >
                    {assignment.status}
                  </Text>
                </View>
              </View>
              <Text className="text-sm text-ink/50">{assignment.classes?.name}</Text>
              <View className="flex-row gap-3">
                <Link href={`/live/${assignment.id}`} asChild>
                  <Pressable>
                    <Text className="text-sm text-brand-600">Monitor live →</Text>
                  </Pressable>
                </Link>
                <Pressable
                  onPress={() =>
                    toggleStatus.mutate({
                      assignmentId: assignment.id,
                      status: assignment.status === 'published' ? 'draft' : 'published',
                    })
                  }
                >
                  <Text className="text-sm text-ink/50">
                    {assignment.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
