import { Text, View } from 'react-native';

import type { HeatmapDay } from '@/hooks/queries/use-class-reports';

const CELL = 13;
const GAP = 3;

function intensityColor(count: number, max: number) {
  if (count === 0) return '#0000000A';
  const ratio = max > 0 ? count / max : 0;
  if (ratio > 0.75) return '#2E6B57';
  if (ratio > 0.5) return '#5FB58C';
  if (ratio > 0.25) return '#9FD4BC';
  return '#D7ECE3';
}

// A GitHub-contributions-style calendar of submission activity over the last 9 weeks —
// shows engagement RHYTHM (steady vs. cram-the-night-before vs. gone quiet) that a single
// "total submissions" number can't.
export function EngagementHeatmap({ data }: { data: HeatmapDay[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {weeks.map((week, wi) => (
          <View key={wi} style={{ gap: GAP }}>
            {week.map((day, di) => (
              <View
                key={di}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 3,
                  backgroundColor: intensityColor(day.count, max),
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <View className="mt-2.5 flex-row items-center gap-1.5">
        <Text className="text-[10px] text-ink/40">Less</Text>
        {['#0000000A', '#D7ECE3', '#9FD4BC', '#5FB58C', '#2E6B57'].map((c, i) => (
          <View key={i} style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: c }} />
        ))}
        <Text className="text-[10px] text-ink/40">More</Text>
      </View>
    </View>
  );
}
