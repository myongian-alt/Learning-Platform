import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentShell } from '@/components/layout/student-shell';
import { useStudentTodo, type TodoItem } from '@/hooks/queries/use-student-todo';

function TodoRow({
  item,
  isLast,
  icon,
  iconColor,
}: {
  item: TodoItem;
  isLast: boolean;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
}) {
  return (
    <Link href={item.href} asChild>
      <Pressable
        className="flex-row items-center gap-2.5 px-0.5 py-2.5"
        style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: 'rgba(0,0,0,0.08)' }}
      >
        <Feather name={icon} size={14} color={iconColor} />
        <Text className="flex-1 text-[12.5px] font-medium text-ink" numberOfLines={1}>
          {item.title}
        </Text>
        <Text className="text-[11px] font-semibold text-violet-700" numberOfLines={1}>
          {item.meta}
        </Text>
      </Pressable>
    </Link>
  );
}

export default function StudentTodoScreen() {
  const { due, recentFeedback, isLoading } = useStudentTodo();

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-paper">
        <ScrollView className="flex-1" contentContainerClassName="pb-11">
          <View className="w-full max-w-[1180px] px-[34px] pt-[34px]" style={{ alignSelf: 'center' }}>
            <Text className="text-[30px] font-bold tracking-tighter text-ink">To-do</Text>
            <Text className="mt-1.5 max-w-[52ch] text-[14.5px] leading-[1.5] text-ink/60">
              What&apos;s waiting on you, and what your teachers just sent back.
            </Text>

            {isLoading && <ActivityIndicator style={{ marginTop: 16 }} />}

            <View className="mt-7">
              <Text className="text-[19px] font-bold tracking-tighter text-ink">Due</Text>
              <View className="mt-3 gap-2 rounded-2xl border border-black/15 bg-white px-2.5 py-1 shadow-sm">
                {!isLoading && due.length === 0 && (
                  <Text className="px-0.5 py-4 text-[13.5px] text-ink/50">
                    Nothing due — you&apos;re all caught up.
                  </Text>
                )}
                {due.map((item, i) => (
                  <TodoRow
                    key={item.key}
                    item={item}
                    isLast={i === due.length - 1}
                    icon="alert-circle"
                    iconColor="#dc2626"
                  />
                ))}
              </View>
            </View>

            <View className="mt-7">
              <Text className="text-[19px] font-bold tracking-tighter text-ink">
                Recent feedback
              </Text>
              <View className="mt-3 gap-2 rounded-2xl border border-black/15 bg-white px-2.5 py-1 shadow-sm">
                {!isLoading && recentFeedback.length === 0 && (
                  <Text className="px-0.5 py-4 text-[13.5px] text-ink/50">
                    No new feedback in the last week.
                  </Text>
                )}
                {recentFeedback.map((item, i) => (
                  <TodoRow
                    key={item.key}
                    item={item}
                    isLast={i === recentFeedback.length - 1}
                    icon="check-circle"
                    iconColor="#059669"
                  />
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </StudentShell>
  );
}
