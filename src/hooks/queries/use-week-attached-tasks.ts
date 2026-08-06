import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import type { AiTaskKind, AttachedCardContent } from './use-lesson-ai-resources';

export interface WeekAttachedTask {
  id: string;
  resourceId: string;
  kind: AiTaskKind;
  content: AttachedCardContent;
  position: number;
  /** 1-based index among this resource's own custom_mcqs tasks (Quiz1, Quiz2, ...);
   * null for khan_academy_video/quizizz_quiz, which aren't numbered/gradable. */
  quizNumber: number | null;
}

// Flat list of AI-attached resources (Khan Academy / Quizizz / custom MCQs) across every
// resource in one open week, for the student's week-detail view — mirrors
// useWeekActivities's one-batched-query-per-week shape rather than one call per resource.
export function useWeekAttachedTasks(resourceIds: string[]) {
  const key = resourceIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['week-attached-tasks', key],
    enabled: resourceIds.length > 0,
    queryFn: async (): Promise<WeekAttachedTask[]> => {
      const { data, error } = await supabase
        .from('lesson_attached_tasks')
        .select('id, resource_id, kind, content, position')
        .in('resource_id', resourceIds)
        .order('position', { ascending: true });
      if (error) throw error;

      const quizCounters = new Map<string, number>();
      return (data ?? [])
        .filter(
          (row): row is typeof row & { kind: AiTaskKind } =>
            row.kind === 'khan_academy_video' ||
            row.kind === 'quizizz_quiz' ||
            row.kind === 'custom_mcqs',
        )
        .map((row) => {
          let quizNumber: number | null = null;
          if (row.kind === 'custom_mcqs') {
            quizNumber = (quizCounters.get(row.resource_id) ?? 0) + 1;
            quizCounters.set(row.resource_id, quizNumber);
          }
          return {
            id: row.id,
            resourceId: row.resource_id,
            kind: row.kind,
            content: row.content as unknown as AttachedCardContent,
            position: row.position,
            quizNumber,
          };
        });
    },
  });
}
