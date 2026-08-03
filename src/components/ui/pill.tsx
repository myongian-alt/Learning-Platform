import { Text, View } from 'react-native';

interface PillProps {
  label: string;
  color: string;
  size?: 'sm' | 'md';
  tintAlpha?: string;
}

const SIZE_CLASSES = {
  sm: 'px-2 py-1',
  md: 'px-3 py-1.5',
} as const;

const TEXT_SIZE_CLASSES = {
  sm: 'text-[10.5px]',
  md: 'text-xs',
} as const;

export function Pill({ label, color, size = 'md', tintAlpha = '1A' }: PillProps) {
  return (
    <View
      className={`self-start rounded-full ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: `${color}${tintAlpha}` }}
    >
      <Text className={`font-bold ${TEXT_SIZE_CLASSES[size]}`} style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
