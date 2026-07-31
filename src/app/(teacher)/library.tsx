import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LibraryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="mx-auto w-full max-w-2xl flex-1 gap-4 px-5 py-6">
        <Text className="text-2xl font-bold text-ink">Library</Text>
        <View className="gap-2 rounded-2xl bg-white p-5 shadow-sm">
          <Text className="text-base font-semibold text-ink">Coming soon</Text>
          <Text className="text-sm text-ink/60">
            Search and import ready-made lessons/quizzes, AI-generate a deck from a topic or
            standard, and clone into an assignment. Backed by the{' '}
            <Text className="font-mono text-xs">library_items</Text> table (with a{' '}
            <Text className="font-mono text-xs">vector</Text> embedding column for semantic search)
            — see ROADMAP.md.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
