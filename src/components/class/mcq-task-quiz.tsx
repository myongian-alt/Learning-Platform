import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { McqQuestion } from '@/hooks/queries/use-lesson-ai-resources';
import { useMyMcqTaskSubmission, type McqAnswers } from '@/hooks/queries/use-mcq-task-submission';

// A student's take on one attached "custom_mcqs" task — 5 questions, single-select each,
// submitted together. Scoring is entirely server-side (the mcq_task_submissions_compute_score
// trigger), so once submitted this only ever displays what the server already graded, never
// a locally-computed score. Already-submitted quizzes render read-only with the correct
// answer marked, matching the reference view a teacher sees before attaching.
export function McqTaskQuizModal({
  taskId,
  studentId,
  title,
  mcqs,
  onClose,
}: {
  taskId: string;
  studentId: string;
  title: string;
  mcqs: McqQuestion[];
  onClose: () => void;
}) {
  const { data: submission, isLoading, submitAnswers } = useMyMcqTaskSubmission(taskId, studentId);
  const [draftAnswers, setDraftAnswers] = useState<McqAnswers>({});

  const alreadySubmitted = Boolean(submission?.submitted_at);
  const allAnswered = mcqs.every((_, i) => draftAnswers[String(i)] !== undefined);
  const submittedAnswers = (submission?.answers ?? {}) as Record<string, number>;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40 p-6">
        <View
          className="w-full max-w-[560px] gap-4 rounded-2xl bg-white p-5"
          style={{ maxHeight: '85%' }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-base font-bold text-ink" numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close quiz"
              className="h-8 w-8 items-center justify-center rounded-full bg-black/5"
            >
              <Feather name="x" size={16} color="#4b5563" />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator />
          ) : alreadySubmitted && submission ? (
            <ScrollView contentContainerClassName="gap-4">
              <View className="items-center gap-1 rounded-xl bg-emerald-50 py-4">
                <Text className="text-3xl font-extrabold text-emerald-700">
                  {submission.score}%
                </Text>
                <Text className="text-xs font-semibold text-emerald-700">
                  {submission.correct_count} of {submission.total_count} correct
                </Text>
              </View>
              {mcqs.map((q, i) => {
                const chosen = submittedAnswers[String(i)];
                return (
                  <View key={i} className="gap-1.5 rounded-xl border border-black/10 p-3">
                    <Text className="text-sm font-semibold text-ink">
                      {i + 1}. {q.question}
                    </Text>
                    {q.choices.map((choice, ci) => (
                      <Text
                        key={ci}
                        className={`text-xs ${
                          ci === q.correctIndex
                            ? 'font-bold text-emerald-700'
                            : ci === chosen
                              ? 'font-bold text-red-600'
                              : 'text-ink/60'
                        }`}
                      >
                        {String.fromCharCode(65 + ci)}. {choice}
                        {ci === q.correctIndex ? ' ✓' : ci === chosen ? ' (your answer)' : ''}
                      </Text>
                    ))}
                    <Text className="text-xs italic text-ink/50">{q.explanation}</Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <ScrollView contentContainerClassName="gap-4">
              {mcqs.map((q, i) => (
                <View key={i} className="gap-1.5">
                  <Text className="text-sm font-semibold text-ink">
                    {i + 1}. {q.question}
                  </Text>
                  {q.choices.map((choice, ci) => {
                    const selected = draftAnswers[String(i)] === ci;
                    return (
                      <Pressable
                        key={ci}
                        onPress={() => setDraftAnswers((prev) => ({ ...prev, [String(i)]: ci }))}
                        className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 ${
                          selected ? 'border-violet-400 bg-violet-50' : 'border-black/10'
                        }`}
                      >
                        <View
                          className={`h-4 w-4 rounded-full border-2 ${
                            selected ? 'border-violet-600 bg-violet-600' : 'border-black/20'
                          }`}
                        />
                        <Text className="flex-1 text-xs text-ink">
                          {String.fromCharCode(65 + ci)}. {choice}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              <Pressable
                onPress={() => submitAnswers.mutate(draftAnswers)}
                disabled={!allAnswered || submitAnswers.isPending}
                style={{ opacity: allAnswered ? 1 : 0.5 }}
                className="items-center rounded-xl bg-violet-600 py-3"
              >
                <Text className="text-sm font-bold text-white">
                  {submitAnswers.isPending ? 'Submitting…' : 'Submit quiz'}
                </Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
