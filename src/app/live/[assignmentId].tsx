import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentTile } from '@/components/teacher/student-tile';
import { useLiveMonitor } from '@/hooks/queries/use-live-monitor';

type Filter = 'all' | 'online' | 'needs-help';

export default function LiveMonitorScreen() {
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const router = useRouter();
  const { roster, isLoading } = useLiveMonitor(assignmentId);
  const [filter, setFilter] = useState<Filter>('all');

  const visibleRoster = roster.filter((entry) => {
    if (filter === 'online') return entry.isOnline;
    if (filter === 'needs-help') return entry.hasOpenHelpRequest;
    return true;
  });

  const helpCount = roster.filter((r) => r.hasOpenHelpRequest).length;

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-row items-center justify-between border-b border-black/5 bg-white px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-brand-600">Close</Text>
        </Pressable>
        <Text className="text-base font-semibold text-ink">Live monitor</Text>
        <View style={{ width: 40 }} />
      </View>

      <View className="flex-row gap-2 px-4 py-3">
        {(['all', 'online', 'needs-help'] as const).map((option) => (
          <Pressable
            key={option}
            onPress={() => setFilter(option)}
            className={`rounded-full px-4 py-2 ${filter === option ? 'bg-brand-500' : 'bg-black/5'}`}
          >
            <Text
              className={`text-sm font-medium ${filter === option ? 'text-white' : 'text-ink/60'}`}
            >
              {option === 'needs-help'
                ? `Needs help (${helpCount})`
                : option === 'all'
                  ? 'All'
                  : 'Online'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerClassName="flex-row flex-wrap gap-3 px-4 pb-6">
        {isLoading && <Text className="text-sm text-ink/50">Loading roster…</Text>}
        {!isLoading && visibleRoster.length === 0 && (
          <Text className="text-sm text-ink/50">No students match this filter.</Text>
        )}
        {visibleRoster.map((entry) => (
          <View key={entry.student.id} className="w-[31%] min-w-[140px]">
            <StudentTile entry={entry} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
