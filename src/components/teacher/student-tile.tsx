import { Text, View } from 'react-native';

import type { RosterEntry } from '@/hooks/queries/use-live-monitor';

export function StudentTile({ entry }: { entry: RosterEntry }) {
  const { student, isOnline, hasOpenHelpRequest } = entry;

  return (
    <View
      className={`aspect-[4/3] w-full gap-2 rounded-2xl border-2 p-3 ${
        hasOpenHelpRequest ? 'border-amber-400 bg-amber-50' : 'border-transparent bg-white'
      }`}
    >
      <View className="flex-1 items-center justify-center rounded-xl bg-black/5">
        <Text className="text-xs text-ink/30">{isOnline ? 'live canvas preview' : 'offline'}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <View className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-black/20'}`} />
        <Text className="flex-1 text-sm font-medium text-ink" numberOfLines={1}>
          {student.full_name}
        </Text>
        {hasOpenHelpRequest && <Text className="text-base">✋</Text>}
      </View>
    </View>
  );
}
