import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentShell } from '@/components/layout/student-shell';
import { useStudentTodo, type TodoItem } from '@/hooks/queries/use-student-todo';

function TodoRow({
  item,
  icon,
  color,
}: {
  item: TodoItem;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}) {
  return (
    <Link href={item.href} asChild>
      <Pressable className="flex-row items-center gap-3.5 rounded-2xl bg-white p-4 shadow-sm">
        <View
          className="h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}1A` }}
        >
          <Feather name={icon} size={16} color={color} />
        </View>
        <View className="flex-1">
          <Text className="text-[14.5px] font-bold text-lf-ink" numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="text-xs text-lf-muted">{item.meta}</Text>
        </View>
        <Feather name="chevron-right" size={16} color="#B4B0C4" />
      </Pressable>
    </Link>
  );
}

export default function StudentTodoScreen() {
  const { due, recentFeedback, isLoading } = useStudentTodo();

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-lf-canvas">
        <ScrollView contentContainerClassName="gap-6 px-5 py-6 md:px-9" className="flex-1">
          <View className="mx-auto w-full max-w-3xl gap-6">
            <View>
              <Text className="text-3xl font-extrabold tracking-tight text-lf-ink">To-do</Text>
              <Text className="text-base text-lf-muted">
                What&apos;s waiting on you, and what your teachers just sent back.
              </Text>
            </View>

            {isLoading && <ActivityIndicator />}

            <View className="gap-3">
              <Text className="text-xs font-bold uppercase tracking-wide text-lf-muted3">Due</Text>
              {!isLoading && due.length === 0 && (
                <Text className="text-sm text-lf-muted">
                  Nothing due — you&apos;re all caught up.
                </Text>
              )}
              {due.map((item) => (
                <TodoRow key={item.key} item={item} icon="alert-circle" color="#EF4444" />
              ))}
            </View>

            <View className="gap-3">
              <Text className="text-xs font-bold uppercase tracking-wide text-lf-muted3">
                Recent feedback
              </Text>
              {!isLoading && recentFeedback.length === 0 && (
                <Text className="text-sm text-lf-muted">No new feedback in the last week.</Text>
              )}
              {recentFeedback.map((item) => (
                <TodoRow key={item.key} item={item} icon="check-circle" color="#10B981" />
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </StudentShell>
  );
}
