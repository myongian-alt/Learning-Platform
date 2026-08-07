import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { McqTaskQuizModal } from '@/components/class/mcq-task-quiz';
import type { McqQuestion } from '@/hooks/queries/use-lesson-ai-resources';
import type { SlideAnswers, SlideObject } from '@/hooks/queries/use-lesson-slides';
import { useMyGradebook, type GradebookColumn } from '@/hooks/queries/use-gradebook';
import { gradableObjects, effectivePointsMap, isAnswerCorrect } from '@/lib/slide-grading';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { SlideGradingMode } from '@/types/database';

const GRADEBOOK_ROW_HEIGHT = 44;
const GRADEBOOK_HEADER_HEIGHT = 60;
const GRADEBOOK_COL_WIDTH = 108;
const GRADEBOOK_NAME_COL_WIDTH = 168;

// The student's own gradebook — the exact same spreadsheet grid a teacher sees
// (src/app/class/[classId].tsx's GradebookSection, same column widths/labels/order via the
// shared useMyGradebook), just scoped to this one student's row. Below it, every column is
// also listed as a tappable card; tapping one expands the exact grading detail inline right
// there (per-question marks + feedback for a slide, the full quiz review for a quiz, or just
// the label+score for a custom column, which has no further breakdown to show).
export function StudentGradebookView({ classId }: { classId: string }) {
  const studentId = useAuthStore((s) => s.session?.user.id);
  const gradebook = useMyGradebook(classId, studentId ?? null);
  const columns = gradebook.data?.columns ?? [];
  const scores = gradebook.data?.rows[0]?.scores ?? {};
  const [expandedColumnId, setExpandedColumnId] = useState<string | null>(null);

  return (
    <ScrollView contentContainerClassName="gap-6 p-5">
      <View>
        <Text className="text-2xl font-bold text-ink">Gradebook</Text>
        <Text className="text-sm text-ink/50">
          Every graded slide and quiz — tap an item below to see exactly how it was marked.
        </Text>
      </View>

      {gradebook.isLoading && <ActivityIndicator />}

      {!gradebook.isLoading && columns.length === 0 && (
        <View className="items-center justify-center rounded-2xl border border-dashed border-black/10 py-10">
          <Text className="text-sm text-ink/40">Nothing graded yet.</Text>
        </View>
      )}

      {!gradebook.isLoading && columns.length > 0 && (
        <>
          <View className="flex-row overflow-hidden rounded-2xl border border-black/5 bg-white">
            <View style={{ width: GRADEBOOK_NAME_COL_WIDTH }}>
              <View
                style={{ height: GRADEBOOK_HEADER_HEIGHT }}
                className="justify-center border-b border-r border-black/5 bg-black/[0.02] px-3"
              >
                <Text className="text-[10px] font-bold uppercase tracking-wide text-ink/40">
                  Student
                </Text>
              </View>
              <View
                style={{ height: GRADEBOOK_ROW_HEIGHT }}
                className="justify-center border-r border-black/5 px-3"
              >
                <Text className="text-xs font-semibold text-ink">You</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View className="flex-row">
                  {columns.map((col) => (
                    <View
                      key={col.id}
                      style={{ width: GRADEBOOK_COL_WIDTH, height: GRADEBOOK_HEADER_HEIGHT }}
                      className="items-center justify-center border-b border-r border-black/5 bg-black/[0.02] px-1.5"
                    >
                      <Text
                        className="text-center text-[10px] font-bold text-ink/60"
                        numberOfLines={2}
                      >
                        {col.label}
                      </Text>
                      {col.kind === 'slide' && col.gradingMode && (
                        <View className="mt-0.5 flex-row items-center gap-0.5">
                          <Feather
                            name={col.gradingMode === 'auto' ? 'zap' : 'edit-3'}
                            size={7}
                            color="#9ca3af"
                          />
                          <Text className="text-[7px] font-medium text-ink/40">
                            {col.gradingMode === 'auto' ? 'Auto' : 'Manual'}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
                <View className="flex-row">
                  {columns.map((col) => {
                    const score = scores[col.id];
                    return (
                      <View
                        key={col.id}
                        style={{ width: GRADEBOOK_COL_WIDTH, height: GRADEBOOK_ROW_HEIGHT }}
                        className="items-center justify-center border-b border-r border-black/5"
                      >
                        <Text
                          className={
                            score !== null ? 'text-xs font-bold text-ink' : 'text-xs text-ink/25'
                          }
                        >
                          {score !== null ? `${score}%` : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>

          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wide text-ink/40">
              Tap an item for details
            </Text>
            {columns.map((col) => (
              <GradebookItemCard
                key={col.id}
                column={col}
                score={scores[col.id] ?? null}
                studentId={studentId ?? null}
                expanded={expandedColumnId === col.id}
                onToggle={() => setExpandedColumnId((id) => (id === col.id ? null : col.id))}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function GradebookItemCard({
  column,
  score,
  studentId,
  expanded,
  onToggle,
}: {
  column: GradebookColumn;
  score: number | null;
  studentId: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View className="overflow-hidden rounded-xl border border-black/5 bg-white">
      <Pressable onPress={onToggle} className="flex-row items-center justify-between gap-2 p-3.5">
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
            {column.label}
          </Text>
          <Text className="text-xs text-ink/40">
            {column.kind === 'slide'
              ? column.gradingMode === 'auto'
                ? 'Auto-graded'
                : 'Teacher-graded'
              : column.kind === 'quiz'
                ? 'Auto-graded quiz'
                : 'Manually entered'}
          </Text>
        </View>
        <Text
          className={score !== null ? 'text-sm font-bold text-violet-700' : 'text-sm text-ink/30'}
        >
          {score !== null ? `${score}%` : '—'}
        </Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#9ca3af" />
      </Pressable>
      {expanded && (
        <View className="border-t border-black/5 bg-black/[0.015] p-3.5">
          {column.kind === 'slide' && (
            <SlideItemDetail slideId={column.id.replace('slide:', '')} studentId={studentId} />
          )}
          {column.kind === 'quiz' && (
            <QuizItemDetail
              taskId={column.id.replace('quiz:', '')}
              studentId={studentId}
              label={column.label}
            />
          )}
          {column.kind === 'custom' && (
            <Text className="text-xs text-ink/50">
              Entered directly by your teacher — there&apos;s no per-question breakdown for this
              one.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function useSlideGradeDetail(slideId: string | null, studentId: string | null) {
  return useQuery({
    queryKey: ['slide-grade-detail', slideId, studentId],
    enabled: Boolean(slideId) && Boolean(studentId),
    queryFn: async () => {
      const [slideRes, subRes] = await Promise.all([
        supabase.from('lesson_slides').select('objects, grading_mode').eq('id', slideId!).single(),
        supabase
          .from('slide_submissions')
          .select('answers, grade, feedback, submitted_at')
          .eq('slide_id', slideId!)
          .eq('student_id', studentId!)
          .maybeSingle(),
      ]);
      if (slideRes.error) throw slideRes.error;
      if (subRes.error) throw subRes.error;
      return {
        objects: (slideRes.data.objects ?? []) as unknown as SlideObject[],
        gradingMode: slideRes.data.grading_mode as SlideGradingMode,
        answers: (subRes.data?.answers ?? {}) as unknown as SlideAnswers,
        grade: subRes.data?.grade ?? null,
        feedback: subRes.data?.feedback ?? null,
        submitted: Boolean(subRes.data?.submitted_at),
      };
    },
  });
}

function SlideItemDetail({ slideId, studentId }: { slideId: string; studentId: string | null }) {
  const detail = useSlideGradeDetail(slideId, studentId);

  if (detail.isLoading) return <ActivityIndicator size="small" />;
  if (!detail.data) return null;
  const { objects, gradingMode, answers, grade, feedback, submitted } = detail.data;

  if (!submitted) {
    return <Text className="text-xs text-ink/50">You haven&apos;t submitted this one yet.</Text>;
  }

  const questions = gradableObjects(objects);
  const pointsMap = effectivePointsMap(objects);

  return (
    <View className="gap-2.5">
      {gradingMode === 'manual' ? (
        <View className="gap-1">
          <Text className="text-xs font-semibold text-ink">
            {grade !== null ? `Grade: ${grade}/100` : 'Waiting to be graded'}
          </Text>
          {feedback && <Text className="text-xs text-ink/60">{feedback}</Text>}
        </View>
      ) : questions.length === 0 ? (
        <Text className="text-xs text-ink/50">No auto-graded questions on this slide.</Text>
      ) : (
        questions.map((q) => {
          const given = answers[q.id];
          const correct = isAnswerCorrect(q, given);
          const points = pointsMap.get(q.id) ?? 0;
          return (
            <View key={q.id} className="gap-1 rounded-lg border border-black/5 bg-white p-2.5">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 text-xs font-semibold text-ink">{q.prompt}</Text>
                <Text
                  className={`text-xs font-bold ${correct ? 'text-emerald-700' : 'text-red-600'}`}
                >
                  {correct ? points : 0}/{points} pts
                </Text>
              </View>
              {q.type === 'fill_blank' ? (
                <Text className="text-xs text-ink/60">
                  Your answer:{' '}
                  <Text className={correct ? 'text-emerald-700' : 'text-red-600'}>
                    {String(given ?? '—')}
                  </Text>
                  {!correct && <Text className="text-ink/60"> · Correct: {q.answer}</Text>}
                </Text>
              ) : (
                q.options.map((opt, i) => (
                  <Text
                    key={i}
                    className={`text-xs ${
                      i === q.correctIndex
                        ? 'font-bold text-emerald-700'
                        : i === given
                          ? 'font-bold text-red-600'
                          : 'text-ink/50'
                    }`}
                  >
                    {String.fromCharCode(65 + i)}. {opt}
                    {i === q.correctIndex ? ' ✓' : i === given ? ' (your answer)' : ''}
                  </Text>
                ))
              )}
            </View>
          );
        })
      )}
      {gradingMode === 'auto' && feedback && (
        <Text className="text-xs italic text-ink/50">{feedback}</Text>
      )}
    </View>
  );
}

function QuizItemDetail({
  taskId,
  studentId,
  label,
}: {
  taskId: string;
  studentId: string | null;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const taskQuery = useQuery({
    queryKey: ['gradebook-quiz-task', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_attached_tasks')
        .select('content')
        .eq('id', taskId)
        .single();
      if (error) throw error;
      return (data.content ?? []) as unknown as McqQuestion[];
    },
  });

  return (
    <View className="gap-2">
      <Pressable
        onPress={() => setOpen(true)}
        disabled={taskQuery.isLoading}
        className="flex-row items-center gap-1.5 self-start rounded-lg bg-violet-50 px-3 py-2"
      >
        <Feather name="eye" size={12} color="#7c3aed" />
        <Text className="text-xs font-semibold text-violet-700">
          {taskQuery.isLoading ? 'Loading…' : 'View full quiz review'}
        </Text>
      </Pressable>
      {open && taskQuery.data && studentId && (
        <McqTaskQuizModal
          taskId={taskId}
          studentId={studentId}
          title={label}
          mcqs={taskQuery.data}
          onClose={() => setOpen(false)}
        />
      )}
    </View>
  );
}
