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
        style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: '#D3D0F0' }}
      >
        <Feather name={icon} size={14} color={iconColor} />
        <Text
          className="flex-1 font-desk-sans-medium text-[12.5px] text-desk-body"
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text
          className="font-desk-sans-semibold text-[11px]"
          style={{ color: '#5B57A8' }}
          numberOfLines={1}
        >
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
      <SafeAreaView className="flex-1 bg-desk-canvas">
        <ScrollView className="flex-1" contentContainerClassName="pb-11">
          <View className="w-full max-w-[1180px] px-[34px] pt-[34px]" style={{ alignSelf: 'center' }}>
            <Text className="font-poppins-semibold text-[30px] tracking-tighter text-desk-body">
              To-do
            </Text>
            <Text className="mt-1.5 max-w-[52ch] font-desk-sans text-[14.5px] leading-[1.5] text-desk-body2">
              What&apos;s waiting on you, and what your teachers just sent back.
            </Text>

            {isLoading && <ActivityIndicator style={{ marginTop: 16 }} />}

            <View className="mt-7">
              <Text className="font-poppins-semibold text-[19px] tracking-tighter text-desk-body">
                Due
              </Text>
              <View className="mt-3 rounded border border-desk-indigoTintBorder bg-desk-indigoTint px-2.5 py-1">
                {!isLoading && due.length === 0 && (
                  <Text className="px-0.5 py-4 font-desk-sans text-[13.5px] text-desk-muted3">
                    Nothing due — you&apos;re all caught up.
                  </Text>
                )}
                {due.map((item, i) => (
                  <TodoRow
                    key={item.key}
                    item={item}
                    isLast={i === due.length - 1}
                    icon="alert-circle"
                    iconColor="#C4451F"
                  />
                ))}
              </View>
            </View>

            <View className="mt-7">
              <Text className="font-poppins-semibold text-[19px] tracking-tighter text-desk-body">
                Recent feedback
              </Text>
              <View className="mt-3 rounded border border-desk-indigoTintBorder bg-desk-indigoTint px-2.5 py-1">
                {!isLoading && recentFeedback.length === 0 && (
                  <Text className="px-0.5 py-4 font-desk-sans text-[13.5px] text-desk-muted3">
                    No new feedback in the last week.
                  </Text>
                )}
                {recentFeedback.map((item, i) => (
                  <TodoRow
                    key={item.key}
                    item={item}
                    isLast={i === recentFeedback.length - 1}
                    icon="check-circle"
                    iconColor="#2E6B57"
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
