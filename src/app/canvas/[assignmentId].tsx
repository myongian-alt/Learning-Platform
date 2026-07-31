import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CanvasToolbar } from '@/components/canvas/canvas-toolbar';
import { InfiniteCanvas, type InfiniteCanvasHandle } from '@/components/canvas/infinite-canvas';
import { useAssignmentSession } from '@/hooks/queries/use-assignment-session';
import { useCanvasPresence } from '@/hooks/use-canvas-presence';

export default function AssignmentCanvasScreen() {
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const router = useRouter();
  const canvasRef = useRef<InfiniteCanvasHandle>(null);
  const [isHandRaised, setIsHandRaised] = useState(false);

  useCanvasPresence(assignmentId);
  const { assignmentQuery, submissionQuery, raiseHand, saveStroke } =
    useAssignmentSession(assignmentId);

  const page = assignmentQuery.data?.assignment_pages?.[0];

  if (assignmentQuery.isLoading || submissionQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (assignmentQuery.error || !page) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-paper px-6">
        <Text className="text-center text-base text-ink/60">
          Couldn&apos;t load this assignment. It may not have any pages yet, or Supabase isn&apos;t
          connected.
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-brand-600">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const handleRaiseHand = () => {
    setIsHandRaised(true);
    raiseHand.mutate(page.id);
  };

  const handleStrokeComplete = (stroke: {
    color: string;
    strokeWidth: number;
    points: { x: number; y: number }[];
  }) => {
    if (!submissionQuery.data) return;
    saveStroke.mutate({
      pageId: page.id,
      submissionId: submissionQuery.data.id,
      ...stroke,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between border-b border-black/5 bg-white px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-brand-600">Close</Text>
        </Pressable>
        <Text className="text-base font-semibold text-ink">{assignmentQuery.data?.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <InfiniteCanvas ref={canvasRef} onStrokeComplete={handleStrokeComplete} />

      <CanvasToolbar
        onUndo={() => canvasRef.current?.undo()}
        onRaiseHand={handleRaiseHand}
        isHandRaised={isHandRaised}
      />
    </SafeAreaView>
  );
}
