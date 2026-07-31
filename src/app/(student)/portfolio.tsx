import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PortfolioScreen() {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="mx-auto w-full max-w-2xl flex-1 gap-4 px-5 py-6">
        <Text className="text-2xl font-bold text-ink">Portfolio</Text>
        <View className="gap-2 rounded-2xl bg-white p-5 shadow-sm">
          <Text className="text-base font-semibold text-ink">Coming soon</Text>
          <Text className="text-sm text-ink/60">
            This will show every graded submission over time — a history view built from the{' '}
            <Text className="font-mono text-xs">submissions</Text> and{' '}
            <Text className="font-mono text-xs">responses</Text> tables, with mastery trends per
            standard. See ROADMAP.md.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
