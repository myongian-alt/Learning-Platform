import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { SidebarItem } from './teacher-sidebar';

const CLASS_CHIP_COLORS = ['#E8B04B', '#5FB58C', '#8C8BF0', '#4B7BF5', '#F4756B'];

export interface DeskEnrolledClass {
  id: string;
  name: string;
}

interface DeskSidebarProps {
  items: SidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onSelectClass: (classId: string) => void;
  studentName: string;
  roleLabel: string;
  classes: DeskEnrolledClass[];
  streak: number;
  /** Shown next to the nav item with key `'todo'`, when > 0 — how many open items. */
  todoCount?: number;
  onProfilePress?: () => void;
}

// The student "Desk" shell's sidebar — visually distinct from `TeacherSidebar` (near-black
// vs navy, amber active state vs violet, Poppins wordmark, plus an "Enrolled" class list and
// a real streak block neither of which the teacher sidebar has) rather than a themed variant
// of it, since the two diverge on more than color.
export function DeskSidebar({
  items,
  activeKey,
  onSelect,
  onSelectClass,
  studentName,
  roleLabel,
  classes,
  streak,
  todoCount = 0,
  onProfilePress,
}: DeskSidebarProps) {
  const initial = studentName.trim().charAt(0).toUpperCase() || '?';
  const streakBars = Array.from({ length: 7 }, (_, i) => i < Math.min(streak, 7));

  return (
    <View className="h-full w-[236px] justify-between bg-desk-ink px-4 pb-[22px] pt-[26px]">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="flex-row items-center gap-2.5 px-2 pb-[26px]">
          <Svg width={34} height={34} viewBox="0 0 40 40">
            <Defs>
              <LinearGradient id="deskMark" x1="0" y1="0" x2="40" y2="40">
                <Stop offset="0" stopColor="#7B5CF0" />
                <Stop offset="1" stopColor="#4B7BF5" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={40} height={40} rx={12} fill="url(#deskMark)" />
            <Path
              d="M14.5 8.5c.9 3.1 1.6 3.8 4.7 4.7-3.1.9-3.8 1.6-4.7 4.7-.9-3.1-1.6-3.8-4.7-4.7 3.1-.9 3.8-1.6 4.7-4.7z"
              fill="#FFFFFF"
            />
            <Path
              d="M23.5 17c.6 2 1 2.4 3 3-2 .6-2.4 1-3 3-.6-2-1-2.4-3-3 2-.6 2.4-1 3-3z"
              fill="#FFFFFF"
            />
          </Svg>
          <Text className="font-poppins text-[21px] tracking-tighter text-desk-text">
            LearnFlow
          </Text>
        </View>

        <View className="gap-px">
          {items.map((item) => {
            const active = item.key === activeKey;
            return (
              <Pressable
                key={item.key}
                onPress={() => onSelect(item.key)}
                className="flex-row items-center gap-3 rounded-lg px-3 py-2.5"
                style={{ backgroundColor: active ? '#E8B04B' : 'transparent' }}
              >
                <Feather
                  name={item.icon}
                  size={17}
                  color={active ? '#0B0B0B' : '#9C968B'}
                  strokeWidth={1.9}
                />
                <Text
                  className="font-desk-sans-semibold text-[14.5px]"
                  style={{ color: active ? '#0B0B0B' : '#9C968B' }}
                >
                  {item.label}
                </Text>
                {item.key === 'todo' && todoCount > 0 ? (
                  <Text className="ml-auto text-[11.5px] font-bold text-desk-amber">
                    {todoCount}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {classes.length > 0 && (
          <View className="mt-[18px] border-t border-desk-rule pt-[18px]">
            <Text className="px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-desk-dim">
              Enrolled
            </Text>
            <View className="mt-2.5 gap-px">
              {classes.map((c, i) => (
                <Pressable
                  key={c.id}
                  onPress={() => onSelectClass(c.id)}
                  className="flex-row items-center gap-2.5 rounded-lg px-3 py-[7px]"
                >
                  <View
                    className="h-[7px] w-[7px] rounded-sm"
                    style={{ backgroundColor: CLASS_CHIP_COLORS[i % CLASS_CHIP_COLORS.length] }}
                  />
                  <Text
                    className="flex-1 text-[13.5px] text-desk-chip"
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View className="mt-3.5 gap-3.5">
        <View className="px-3">
          <Text className="text-[11px] font-semibold uppercase tracking-[0.1em] text-desk-dim">
            Streak
          </Text>
          <View className="mt-1 flex-row items-baseline gap-1.5">
            <Text className="font-poppins-semibold text-[28px] leading-none text-desk-text">
              {streak}
            </Text>
            <Text className="text-[12.5px] text-desk-muted">
              {streak === 1 ? 'day running' : 'days running'}
            </Text>
          </View>
          <View className="mt-2.5 flex-row gap-1">
            {streakBars.map((lit, i) => (
              <View
                key={i}
                className="h-1 flex-1"
                style={{ backgroundColor: lit ? '#E8B04B' : '#2B2B27' }}
              />
            ))}
          </View>
        </View>

        <Pressable
          onPress={onProfilePress}
          className="flex-row items-center gap-2.5 rounded-[9px] px-2.5 py-[9px]"
        >
          <View className="h-[30px] w-[30px] items-center justify-center rounded-full bg-desk-amber">
            <Text className="text-[12.5px] font-bold text-desk-ink">{initial}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-[13.5px] font-bold text-desk-text" numberOfLines={1}>
              {studentName}
            </Text>
            <Text className="text-[11.5px] text-desk-dim" numberOfLines={1}>
              {roleLabel}
            </Text>
          </View>
          <Feather name="chevron-down" size={15} color="#6B665D" />
        </Pressable>
      </View>
    </View>
  );
}
