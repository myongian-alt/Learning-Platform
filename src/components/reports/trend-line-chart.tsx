import { View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import type { TrendPoint } from '@/hooks/queries/use-class-reports';

const HEIGHT = 180;
const PADDING_X = 24;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 26;

// A smooth-ish line + gradient-filled area showing the class's average score over the last
// 8 rolling weeks — the single fastest way to answer "are we trending up or down."
export function TrendLineChart({
  data,
  width = 560,
  color = '#302BB8',
}: {
  data: TrendPoint[];
  width?: number;
  color?: string;
}) {
  const plotWidth = width - PADDING_X * 2;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: PADDING_X + i * stepX,
    y: d.avgScore !== null ? PADDING_TOP + plotHeight * (1 - d.avgScore / 100) : null,
    d,
  }));
  const validPoints = points.filter(
    (p): p is { x: number; y: number; d: TrendPoint } => p.y !== null,
  );

  const linePath = validPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const floorY = PADDING_TOP + plotHeight;
  const areaPath =
    validPoints.length > 1
      ? `${linePath} L ${validPoints[validPoints.length - 1].x} ${floorY} L ${validPoints[0].x} ${floorY} Z`
      : '';

  return (
    <View>
      <Svg width={width} height={HEIGHT}>
        <Defs>
          <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {[0, 50, 100].map((v) => {
          const y = PADDING_TOP + plotHeight * (1 - v / 100);
          return (
            <Line
              key={v}
              x1={PADDING_X}
              y1={y}
              x2={width - PADDING_X}
              y2={y}
              stroke="#00000012"
              strokeWidth={1}
            />
          );
        })}

        {areaPath ? <Path d={areaPath} fill="url(#trendFill)" /> : null}
        {linePath ? (
          <Path
            d={linePath}
            stroke={color}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {validPoints.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill="#fff" stroke={color} strokeWidth={2.5} />
        ))}

        {points.map((p, i) => (
          <SvgText key={i} x={p.x} y={HEIGHT - 8} fontSize={10} fill="#9ca3af" textAnchor="middle">
            {p.d.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
