import { View } from 'react-native';

interface ProgressBarProps {
  percent: number;
  color?: string;
  trackColor?: string;
  height?: number;
}

export function ProgressBar({
  percent,
  color = '#7C3AED',
  trackColor = '#F0EDF7',
  height = 7,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View
      className="w-full overflow-hidden rounded-full"
      style={{ height, backgroundColor: trackColor }}
    >
      <View
        className="h-full rounded-full"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </View>
  );
}
