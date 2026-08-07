import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { AtRiskStudent } from '@/hooks/queries/use-class-reports';

// The one part of this dashboard that's a direct call to action rather than a chart to
// admire — every student who's either scoring low, has done nothing yet, or has gone quiet,
// with the specific reason, so a teacher can act on it in the next 30 seconds instead of
// hunting for it across every other view.
export function AtRiskList({
  data,
  onSelectStudent,
}: {
  data: AtRiskStudent[];
  onSelectStudent?: (studentId: string) => void;
}) {
  if (data.length === 0) {
    return (
      <View className="flex-row items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-3">
        <Feather name="check-circle" size={14} color="#059669" />
        <Text className="text-xs font-semibold text-emerald-700">
          No students flagged — everyone&apos;s on track.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {data.map((s) => (
        <Pressable
          key={s.studentId}
          onPress={() => onSelectStudent?.(s.studentId)}
          disabled={!onSelectStudent}
          className="flex-row items-center gap-3 rounded-xl bg-red-50 px-3.5 py-2.5"
        >
          <Feather name="alert-triangle" size={13} color="#C4451F" />
          <View className="flex-1">
            <Text className="text-xs font-bold text-ink">{s.name}</Text>
            <Text className="text-[11px] text-red-700">{s.reasons.join(' · ')}</Text>
          </View>
          {onSelectStudent && <Feather name="chevron-right" size={13} color="#C4451F" />}
        </Pressable>
      ))}
    </View>
  );
}
