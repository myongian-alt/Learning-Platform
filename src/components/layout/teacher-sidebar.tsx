import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, Text, View } from 'react-native';

export interface SidebarItem {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  ioniconOverride?: keyof typeof Ionicons.glyphMap;
}

// Shared across every teacher screen that shows this sidebar (the classes landing page and
// each class's Lessons screen) so the nav list can't drift out of sync between them.
export const TEACHER_SIDEBAR_ITEMS: SidebarItem[] = [
  { key: 'classes', label: 'Classes', icon: 'grid' },
  { key: 'lessons', label: 'Lessons', icon: 'book-open' },
  { key: 'quizzes', label: 'Quizzis & Games', icon: 'award', ioniconOverride: 'game-controller-outline' },
  { key: 'assignments', label: 'Assignments', icon: 'clipboard' },
  { key: 'reports', label: 'Reports', icon: 'bar-chart-2' },
  { key: 'gradebook', label: 'Gradebook', icon: 'book' },
  { key: 'students', label: 'Students', icon: 'user' },
  { key: 'groups', label: 'Groups', icon: 'users' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

interface TeacherSidebarProps {
  items: SidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  teacherName: string;
  avatarUrl?: string | null;
  onProfilePress?: () => void;
}

export function TeacherSidebar({
  items,
  activeKey,
  onSelect,
  teacherName,
  avatarUrl,
  onProfilePress,
}: TeacherSidebarProps) {
  const initial = teacherName.trim().charAt(0).toUpperCase() || '?';

  return (
    <View className="h-full w-[196px] justify-between bg-[#12142a]">
      <View>
        <View className="flex-row items-center gap-2.5 px-4 pb-5 pt-5">
          <LinearGradient
            colors={['#8b5cf6', '#3b82f6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 30, height: 30, borderRadius: 9 }}
            className="items-center justify-center"
          >
            <Ionicons name="sparkles" size={14} color="#fff" />
          </LinearGradient>
          <Text className="text-base font-bold text-white">LearnFlow</Text>
        </View>

        <View className="gap-0.5 px-2.5">
          {items.map((item) => {
            const active = item.key === activeKey;
            return (
              <Pressable
                key={item.key}
                onPress={() => onSelect(item.key)}
                className={`flex-row items-center gap-2.5 rounded-lg px-2.5 py-2 ${
                  active ? 'bg-violet-600' : ''
                }`}
              >
                {item.ioniconOverride ? (
                  <Ionicons
                    name={item.ioniconOverride}
                    size={15}
                    color={active ? '#ffffff' : 'rgba(255,255,255,0.5)'}
                  />
                ) : (
                  <Feather
                    name={item.icon}
                    size={15}
                    color={active ? '#ffffff' : 'rgba(255,255,255,0.5)'}
                  />
                )}
                <Text
                  className={`text-[13px] font-medium ${active ? 'text-white' : 'text-white/50'}`}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        onPress={onProfilePress}
        className="flex-row items-center gap-2.5 border-t border-white/10 px-4 py-3"
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} className="h-7 w-7 rounded-full" />
        ) : (
          <View className="h-7 w-7 items-center justify-center rounded-full bg-violet-500">
            <Text className="text-xs font-bold text-white">{initial}</Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-[13px] font-semibold text-white" numberOfLines={1}>
            {teacherName}
          </Text>
          <Text className="text-[11px] text-white/50">Teacher</Text>
        </View>
        <Feather name="chevron-down" size={13} color="rgba(255,255,255,0.4)" />
      </Pressable>
    </View>
  );
}
