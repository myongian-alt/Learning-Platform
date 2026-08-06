import { Feather } from '@expo/vector-icons';
import { Text, View } from 'react-native';

export function StatCard({
  icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  suffix?: string;
  accent: string;
}) {
  return (
    <View className="flex-1 gap-2 rounded-2xl border border-black/5 bg-white p-4" style={{ minWidth: 180 }}>
      <View
        className="h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accent}1A` }}
      >
        <Feather name={icon} size={15} color={accent} />
      </View>
      <View className="flex-row items-baseline gap-1">
        <Text className="text-[26px] font-extrabold tracking-tight text-ink">{value}</Text>
        {suffix && <Text className="text-sm font-bold text-ink/40">{suffix}</Text>}
      </View>
      <Text className="text-xs font-medium text-ink/50">{label}</Text>
    </View>
  );
}
