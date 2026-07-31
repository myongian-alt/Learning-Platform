import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useStudentAssignments } from '@/hooks/queries/use-student-assignments';
import { joinClassWithCode, signOut } from '@/lib/auth-actions';
import { useAuthStore } from '@/store/auth-store';

export default function StudentHomeScreen() {
  const profile = useAuthStore((s) => s.profile);
  const studentId = useAuthStore((s) => s.session?.user.id);
  const { data: assignments, isLoading } = useStudentAssignments();
  const queryClient = useQueryClient();

  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!studentId || !joinCode.trim()) return;
    setJoinError(null);
    setIsJoining(true);
    try {
      await joinClassWithCode(joinCode, studentId);
      setJoinCode('');
      queryClient.invalidateQueries({ queryKey: ['student-assignments', studentId] });
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Could not join that class.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="gap-6 px-5 py-6" className="mx-auto w-full max-w-2xl">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-ink">
              Hi, {profile?.full_name?.split(' ')[0]} 👋
            </Text>
            <Text className="text-base text-ink/60">Here&apos;s what&apos;s on your desk.</Text>
          </View>
          <Text onPress={() => signOut()} className="text-sm text-ink/40">
            Sign out
          </Text>
        </View>

        <View className="gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-ink">Join a class</Text>
          <View className="flex-row items-end gap-3">
            <View className="flex-1">
              <TextField
                label="Class code"
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="e.g. 7F3K2A"
                autoCapitalize="characters"
              />
            </View>
            <Button label="Join" onPress={handleJoin} isLoading={isJoining} variant="secondary" />
          </View>
          {joinError && <Text className="text-sm text-red-600">{joinError}</Text>}
        </View>

        <View className="gap-3">
          <Text className="text-base font-semibold text-ink">Assignments</Text>
          {isLoading && <Text className="text-sm text-ink/50">Loading…</Text>}
          {!isLoading && (assignments?.length ?? 0) === 0 && (
            <Text className="text-sm text-ink/50">
              Nothing assigned yet. Join a class above to see your work.
            </Text>
          )}
          {assignments?.map((assignment) => (
            <Link key={assignment.id} href={`/canvas/${assignment.id}`} asChild>
              <Pressable className="flex-row items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-ink">{assignment.title}</Text>
                  <Text className="text-xs uppercase tracking-wide text-ink/40">
                    {assignment.class_name} · {assignment.submission?.status ?? 'not_started'}
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
