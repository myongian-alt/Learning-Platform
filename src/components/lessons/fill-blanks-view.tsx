import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { SlideAnswers, SlideObject } from '@/hooks/queries/use-lesson-slides';
import { isAnswerCorrect } from '@/lib/slide-grading';

type FillBlank = Extract<SlideObject, { type: 'fill_blank' }>;

// A full-screen, auto-checked presentation of a slide's existing teacher-authored
// fill_blank objects — same reasoning as QuizView: an alternate view over the same
// objects/answers, not a separate authoring or storage system.
export function FillBlanksView({
  questions,
  answers,
  onAnswerChange,
  onClose,
}: {
  questions: FillBlank[];
  answers: SlideAnswers;
  onAnswerChange: (questionId: string, value: string) => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);
  if (questions.length === 0) return null;

  const correctCount = questions.filter((q) => isAnswerCorrect(q, answers[q.id])).length;
  const allCorrect = correctCount === questions.length;

  return (
    <View className="absolute inset-0 z-50 bg-lf-canvas">
      <View className="flex-1 items-center px-6 py-8">
        <View className="w-full max-w-2xl gap-4">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close fill-in-the-blanks"
              className="h-9 w-9 items-center justify-center rounded-xl border border-lf-line bg-white"
            >
              <Feather name="x" size={16} color="#6B6880" />
            </Pressable>
            <Text className="flex-1 text-lg font-extrabold text-lf-ink">Fill in the blanks</Text>
            <View
              className="rounded-full px-3 py-1.5"
              style={{ backgroundColor: checked ? (allCorrect ? '#DCFCE7' : '#FFF4E5') : '#F5F3FA' }}
            >
              <Text
                className="text-[13px] font-bold"
                style={{ color: checked ? (allCorrect ? '#047857' : '#B45309') : '#9C98B4' }}
              >
                {checked ? `${correctCount} of ${questions.length} correct` : 'Not checked yet'}
              </Text>
            </View>
          </View>

          <View className="gap-3 rounded-3xl bg-white p-7 shadow-sm">
            {questions.map((q) => {
              const value = String(answers[q.id] ?? '');
              const correct = isAnswerCorrect(q, answers[q.id]);
              const borderColor = !checked ? (value ? '#7C3AED' : '#E4E0EE') : correct ? '#10B981' : '#EF4444';
              return (
                <View key={q.id} className="gap-2 rounded-2xl bg-lf-canvas2 p-4">
                  <Text className="text-[15px] font-semibold text-lf-ink2">{q.prompt}</Text>
                  <TextInput
                    value={value}
                    onChangeText={(text) => {
                      setChecked(false);
                      onAnswerChange(q.id, text);
                    }}
                    placeholder="Your answer"
                    style={{ borderColor }}
                    className="rounded-xl border-2 bg-white px-3.5 py-2.5 text-[15px] font-bold text-lf-ink"
                  />
                  {checked && (
                    <Text className="text-xs font-bold" style={{ color: correct ? '#047857' : '#B91C1C' }}>
                      {correct ? 'Nice!' : `Answer: ${q.answer}`}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          <Pressable
            onPress={() => setChecked(true)}
            className="self-start rounded-full bg-lf-primary px-6 py-3"
          >
            <Text className="text-sm font-extrabold text-white">Check my answers</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
