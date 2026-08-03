import { Text, View } from 'react-native';

interface StatCardProps {
  label: string;
  value: string | number;
  /** Legacy plain style (teacher dashboard): tints the whole card amber. */
  accent?: boolean;
  /** LearnFlow style: colored icon chip + accent-bordered card. */
  accentColor?: string;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, accent, accentColor, icon }: StatCardProps) {
  if (accentColor) {
    return (
      <View
        className="flex-1 gap-3.5 rounded-2xl border bg-white p-4"
        style={{ borderColor: '#EDEAF4' }}
      >
        {icon && (
          <View
            className="h-9 w-9 items-center justify-center rounded-xl border"
            style={{ backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}55` }}
          >
            {icon}
          </View>
        )}
        <View className="gap-0.5">
          <Text className="text-[26px] font-extrabold tracking-tight text-lf-ink">{value}</Text>
          <Text className="text-[13px] font-semibold text-lf-muted">{label}</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className={`flex-1 gap-1 rounded-2xl p-4 shadow-sm ${accent ? 'bg-amber-100' : 'bg-white'}`}
    >
      <Text className="text-2xl font-bold text-ink">{value}</Text>
      <Text className="text-xs text-ink/50">{label}</Text>
    </View>
  );
}
