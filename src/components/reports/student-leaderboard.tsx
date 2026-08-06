import { Text, View } from 'react-native';

import { scoreBucketColor, type LeaderboardEntry } from '@/hooks/queries/use-class-reports';

const RANK_MEDALS = ['#E8B04B', '#B0B0B0', '#B0703A'];

// Ranked, at-a-glance: who's ahead, who's behind, and how much of the gradable work each
// student has actually completed — the completion fraction matters as much as the score
// itself (a 100% on 1/10 items reads very differently from 100% on 10/10).
export function StudentLeaderboard({ data }: { data: LeaderboardEntry[] }) {
  return (
    <View className="gap-3">
      {data.map((entry, i) => {
        const color = entry.avgScore !== null ? scoreBucketColor(entry.avgScore) : '#D1D5DB';
        return (
          <View key={entry.studentId} className="flex-row items-center gap-3">
            <View
              className="h-5 w-5 items-center justify-center rounded-full"
              style={{ backgroundColor: i < 3 ? `${RANK_MEDALS[i]}22` : '#00000008' }}
            >
              <Text
                className="text-[10px] font-extrabold"
                style={{ color: i < 3 ? RANK_MEDALS[i] : '#9ca3af' }}
              >
                {i + 1}
              </Text>
            </View>
            <Text className="w-28 text-xs font-semibold text-ink" numberOfLines={1}>
              {entry.name}
            </Text>
            <View className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
              <View
                className="h-full rounded-full"
                style={{ width: `${entry.avgScore ?? 0}%`, backgroundColor: color }}
              />
            </View>
            <Text className="w-10 text-right text-xs font-bold text-ink">
              {entry.avgScore !== null ? `${entry.avgScore}%` : '—'}
            </Text>
            <Text className="w-12 text-right text-[10px] text-ink/40">
              {entry.completed}/{entry.total}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
