import { Text, View } from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

import type { DistributionBucket } from '@/hooks/queries/use-class-reports';

const SIZE = 156;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// A donut of where every student's overall average lands (90-100, 80-89, ...) — the
// distribution shape (bunched high vs. spread out vs. bimodal) says more at a glance than
// the class average alone ever could.
export function GradeDonutChart({
  data,
  centerValue,
  centerLabel,
}: {
  data: DistributionBucket[];
  centerValue: string;
  centerLabel: string;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  let cumulative = 0;

  return (
    <View className="flex-row items-center gap-6">
      <Svg width={SIZE} height={SIZE}>
        <G transform={`rotate(-90, ${SIZE / 2}, ${SIZE / 2})`}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="#00000010"
            strokeWidth={STROKE}
            fill="none"
          />
          {total > 0 &&
            data.map((d, i) => {
              if (d.count === 0) return null;
              const fraction = d.count / total;
              const dashOffset = -cumulative * CIRCUMFERENCE;
              cumulative += fraction;
              return (
                <Circle
                  key={i}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  stroke={d.color}
                  strokeWidth={STROKE}
                  fill="none"
                  strokeDasharray={`${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                />
              );
            })}
        </G>
        <SvgText
          x={SIZE / 2}
          y={SIZE / 2 - 2}
          fontSize={24}
          fontWeight="800"
          fill="#1a1a2e"
          textAnchor="middle"
        >
          {centerValue}
        </SvgText>
        <SvgText x={SIZE / 2} y={SIZE / 2 + 16} fontSize={10} fill="#9ca3af" textAnchor="middle">
          {centerLabel}
        </SvgText>
      </Svg>
      <View className="gap-2">
        {data.map((d, i) => (
          <View key={i} className="flex-row items-center gap-2">
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <Text className="w-12 text-xs font-medium text-ink/60">{d.label}</Text>
            <Text className="text-xs font-bold text-ink">{d.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
