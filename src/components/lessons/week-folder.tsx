import { Feather, Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

// Shared between the teacher's week grid (src/app/class/[classId].tsx) and the
// student's (src/components/class/student-class-view.tsx) so the two stay visually
// consistent — same folder-color cycle, same card shell.
export const WEEK_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];

export function weekColor(week: number) {
  return WEEK_COLORS[(week - 1) % WEEK_COLORS.length];
}

interface WeekFolderCardProps {
  week: number;
  lessonsCount: number;
  selected: boolean;
  onPress: () => void;
  /** Student-only: renders a muted/locked look and swaps the icon color. Teacher call
   * sites never pass this, so their card is pixel-identical to before. */
  locked?: boolean;
  /** Student-only: an optional progress bar under the label (0-100). */
  progressPercent?: number | null;
  /** Student-only: replaces the kebab menu with a status pill (e.g. "Done"/"Now"/"Locked"). */
  statusLabel?: string;
}

export function WeekFolderCard({
  week,
  lessonsCount,
  selected,
  onPress,
  locked = false,
  progressPercent = null,
  statusLabel,
}: WeekFolderCardProps) {
  const color = weekColor(week);
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 168,
        backgroundColor: locked ? '#F7F5FB' : selected ? `${color}12` : '#fff',
        borderColor: selected ? color : 'rgba(0,0,0,0.06)',
        opacity: locked ? 0.65 : 1,
      }}
      className="gap-3 rounded-2xl border p-4"
    >
      <View className="flex-row items-start justify-between">
        <Ionicons
          name={selected ? 'folder-open' : 'folder'}
          size={30}
          color={locked ? '#CFC9DE' : color}
        />
        {statusLabel ? (
          <View
            className="rounded-md px-1.5 py-0.5"
            style={{ backgroundColor: locked ? '#F5F3FA' : `${color}1A` }}
          >
            <Text className="text-[9px] font-bold" style={{ color: locked ? '#9C98B4' : color }}>
              {statusLabel}
            </Text>
          </View>
        ) : (
          <Feather name="more-vertical" size={16} color="#9ca3af" />
        )}
      </View>
      <View>
        <Text className="text-base font-bold" style={{ color: locked ? '#9C98B4' : '#1a1a2e' }}>
          Week {week}
        </Text>
        <Text className="text-xs text-ink/45">{lessonsCount} Lessons</Text>
      </View>
      {progressPercent !== null && progressPercent !== undefined && (
        <View className="h-1.5 overflow-hidden rounded-full bg-black/5">
          <View
            className="h-full rounded-full"
            style={{ width: `${progressPercent}%`, backgroundColor: color }}
          />
        </View>
      )}
    </Pressable>
  );
}
