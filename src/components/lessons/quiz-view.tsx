import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ui/progress-bar';
import type { SlideAnswers, SlideObject } from '@/hooks/queries/use-lesson-slides';
import { isAnswerCorrect } from '@/lib/slide-grading';

type MCQuestion = Extract<SlideObject, { type: 'multiple_choice' }>;
const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

// A full-screen, one-at-a-time presentation of a slide's existing teacher-authored
// multiple_choice objects, with instant per-question feedback and a running score —
// an alternate view over the same objects/answers the inline slide layer already
// reads/writes, not a separate authoring or storage system.
export function QuizView({
  questions,
  answers,
  onAnswerChange,
  onClose,
}: {
  questions: MCQuestion[];
  answers: SlideAnswers;
  onAnswerChange: (questionId: string, value: number) => void;
  onClose: () => void;
}) {
  const [qi, setQi] = useState(0);
  const [finished, setFinished] = useState(false);

  if (questions.length === 0) return null;
  const question = questions[Math.min(qi, questions.length - 1)];
  const picked = answers[question.id] as number | undefined;
  const revealed = picked !== undefined;
  const isLast = qi === questions.length - 1;
  const score = questions.filter((q) => isAnswerCorrect(q, answers[q.id])).length;

  const pick = (i: number) => {
    if (revealed) return;
    onAnswerChange(question.id, i);
  };

  const next = () => {
    if (!revealed) return;
    if (isLast) setFinished(true);
    else setQi((i) => i + 1);
  };

  return (
    <View className="absolute inset-0 z-50 bg-lf-canvas">
      <View className="flex-1 items-center px-6 py-8">
        <View className="w-full max-w-2xl gap-4">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close quiz"
              className="h-9 w-9 items-center justify-center rounded-xl border border-lf-line bg-white"
            >
              <Feather name="x" size={16} color="#6B6880" />
            </Pressable>
            <View className="flex-1">
              <ProgressBar percent={((finished ? questions.length : qi) / questions.length) * 100} />
            </View>
            <Text className="text-[13px] font-bold text-lf-muted">
              {finished ? questions.length : qi + 1} / {questions.length}
            </Text>
            <View className="flex-row items-center gap-1.5 rounded-full border border-lf-line bg-white px-3 py-1.5">
              <View className="h-1.5 w-1.5 rounded-full bg-lf-success" />
              <Text className="text-[13px] font-bold text-lf-ink">{score} pts</Text>
            </View>
          </View>

          {!finished ? (
            <View className="gap-6 rounded-3xl bg-white p-9 shadow-sm">
              <View className="gap-3">
                <Text className="text-xs font-bold uppercase tracking-wide text-lf-primaryLight">
                  Question {qi + 1}
                </Text>
                <Text className="text-2xl font-extrabold tracking-tight text-lf-ink">
                  {question.prompt}
                </Text>
              </View>

              <View className="gap-3">
                {question.options.map((option, i) => {
                  const isCorrect = i === question.correctIndex;
                  const isChosen = picked === i;
                  const bg = revealed && isCorrect ? '#F2FCF7' : revealed && isChosen ? '#FEF4F4' : '#fff';
                  const border =
                    revealed && isCorrect ? '#10B981' : revealed && isChosen ? '#EF4444' : '#EDEAF4';
                  return (
                    <Pressable
                      key={i}
                      onPress={() => pick(i)}
                      style={{ borderColor: border, backgroundColor: bg }}
                      className="flex-row items-center gap-3 rounded-2xl border-2 px-4 py-4"
                    >
                      <View className="h-7 w-7 items-center justify-center rounded-lg bg-lf-canvas3">
                        <Text className="text-xs font-bold text-lf-muted">{OPTION_KEYS[i]}</Text>
                      </View>
                      <Text className="flex-1 text-[15.5px] font-bold text-lf-ink">{option}</Text>
                      {revealed && isCorrect && <Feather name="check" size={16} color="#10B981" />}
                      {revealed && isChosen && !isCorrect && (
                        <Feather name="x" size={16} color="#EF4444" />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-[13.5px] font-semibold text-lf-muted">
                  {!revealed ? 'Pick an answer' : picked === question.correctIndex ? 'Correct!' : 'Not quite.'}
                </Text>
                <Pressable
                  onPress={next}
                  disabled={!revealed}
                  style={{ opacity: revealed ? 1 : 0.4 }}
                  className="rounded-full bg-lf-primary px-6 py-3"
                >
                  <Text className="text-sm font-extrabold text-white">
                    {isLast ? 'Finish' : 'Next question'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="items-center gap-4 rounded-3xl bg-white p-9 py-11 shadow-sm">
              <View className="h-[110px] w-[110px] items-center justify-center rounded-full border-8 border-lf-primary">
                <Text className="text-3xl font-extrabold text-lf-ink">{score}</Text>
                <Text className="text-[11px] font-bold text-lf-muted">of {questions.length}</Text>
              </View>
              <Text className="text-2xl font-extrabold tracking-tight text-lf-ink">Nice run!</Text>
              <Text className="text-center text-[15px] text-lf-muted">Your score has been saved.</Text>
              <Pressable onPress={onClose} className="mt-2 rounded-full bg-lf-primary px-6 py-3">
                <Text className="text-sm font-extrabold text-white">Done</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
