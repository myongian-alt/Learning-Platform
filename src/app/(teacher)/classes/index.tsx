import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useTeacherClasses } from '@/hooks/queries/use-teacher-classes';

export default function TeacherClassesScreen() {
  const { classesQuery, createClass } = useTeacherClasses();
  const [name, setName] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    createClass.mutate(name.trim());
    setName('');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="gap-6 px-5 py-6" className="mx-auto w-full max-w-2xl">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-ink">Classes</Text>
          <Link href="/create-class" asChild>
            <Pressable>
              <Text className="text-sm font-medium text-brand-600">Guided setup ✨</Text>
            </Pressable>
          </Link>
        </View>

        <View className="flex-row items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <View className="flex-1">
            <TextField
              label="New class name"
              value={name}
              onChangeText={setName}
              placeholder="Period 3 Biology"
            />
          </View>
          <Button
            label="Create"
            onPress={handleCreate}
            isLoading={createClass.isPending}
            variant="secondary"
          />
        </View>

        <View className="gap-3">
          {classesQuery.isLoading && <Text className="text-sm text-ink/50">Loading…</Text>}
          {classesQuery.data?.map((classRow: any) => (
            <Link key={classRow.id} href={`/class/${classRow.id}`} asChild>
              <Pressable className="gap-2 rounded-2xl bg-white p-4 shadow-sm">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-ink">{classRow.name}</Text>
                  <Text className="text-xs text-ink/40">
                    {classRow.class_members?.[0]?.count ?? 0} students
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-ink/50">Join code</Text>
                  <Text className="rounded-md bg-brand-50 px-2 py-1 font-mono text-sm font-semibold text-brand-700">
                    {classRow.join_code}
                  </Text>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
