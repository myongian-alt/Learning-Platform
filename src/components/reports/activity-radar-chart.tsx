import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import type { RadarAxis } from '@/hooks/queries/use-class-reports';

const SIZE = 260;
const CENTER = SIZE / 2;
const MAX_RADIUS = SIZE / 2 - 46;
const RING_LEVELS = [25, 50, 75, 100];

function pointFor(index: number, total: number, value: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (value / 100) * MAX_RADIUS;
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

// A spider chart of average score per activity type (Warm Up, Independent, Group Work,
// Quizzes, ...) — reveals which KIND of work the class handles well vs. struggles with,
// something a single class-average number can never show.
export function ActivityRadarChart({ data, color = '#302BB8' }: { data: RadarAxis[]; color?: string }) {
  const total = data.length;
  if (total < 3) return null;

  const dataPoints = data.map((d, i) => pointFor(i, total, d.avgScore ?? 0));
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width={SIZE} height={SIZE}>
      {RING_LEVELS.map((level) => (
        <Polygon
          key={level}
          points={Array.from({ length: total }, (_, i) => {
            const p = pointFor(i, total, level);
            return `${p.x},${p.y}`;
          }).join(' ')}
          fill="none"
          stroke="#00000012"
          strokeWidth={1}
        />
      ))}

      {Array.from({ length: total }, (_, i) => {
        const p = pointFor(i, total, 100);
        return <Line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="#00000012" strokeWidth={1} />;
      })}

      <Polygon points={polygonPoints} fill={`${color}2E`} stroke={color} strokeWidth={2} />

      {dataPoints.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} />
      ))}

      {data.map((d, i) => {
        const labelPoint = pointFor(i, total, 128);
        return (
          <SvgText
            key={i}
            x={labelPoint.x}
            y={labelPoint.y}
            fontSize={10.5}
            fontWeight="700"
            fill="#4b5563"
            textAnchor="middle"
          >
            {d.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}
