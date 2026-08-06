import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { McqTaskSubmission } from '@/types/database';

// Keyed by the question's index in the McqQuestion[] array (as a string, matching how
// jsonb object keys work), value is the chosen choice index.
export type McqAnswers = Record<string, number>;

// Student-facing: this student's own submission for one attached MCQ task. Scoring
// (correct_count/total_count/score) is computed entirely server-side by the
// mcq_task_submissions_compute_score trigger — this only ever writes answers, never a score,
// so a student has no way to set their own grade.
export function useMyMcqTaskSubmission(taskId: string | null, studentId: string | null) {
  const queryClient = useQueryClient();
  const enabled = Boolean(taskId) && Boolean(studentId);
  const queryKey = ['mcq-task-submission', taskId, studentId];

  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async (): Promise<McqTaskSubmission | null> => {
      const { data, error } = await supabase
        .from('mcq_task_submissions')
        .select('*')
        .eq('task_id', taskId!)
        .eq('student_id', studentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const submitAnswers = useMutation({
    mutationFn: async (answers: McqAnswers) => {
      const { error } = await supabase.from('mcq_task_submissions').upsert(
        { task_id: taskId!, student_id: studentId!, answers: answers as never },
        { onConflict: 'task_id,student_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, submitAnswers };
}

// Teacher-facing: every student's submission across a set of attached MCQ tasks in one
// query — the gradebook uses this to pull all quiz scores for a class at once rather than
// one request per task.
export function useMcqTaskSubmissions(taskIds: string[]) {
  const key = taskIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['mcq-task-submissions', key],
    enabled: taskIds.length > 0,
    queryFn: async (): Promise<McqTaskSubmission[]> => {
      const { data, error } = await supabase
        .from('mcq_task_submissions')
        .select('*')
        .in('task_id', taskIds);
      if (error) throw error;
      return data ?? [];
    },
  });
}
