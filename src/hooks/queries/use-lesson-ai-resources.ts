import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { LessonTaskKind } from '@/types/database';

export interface KhanAcademyResource {
  title: string;
  url: string;
  description: string;
}

export interface QuizizzResource {
  title: string;
  url: string;
  questionCount: number;
  description: string;
}

export interface McqQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  /** Point weight out of 100, resolved (never "auto") at the moment the teacher attaches this
   * quiz — see `TaskPickerOverlay`'s review step, where a teacher can adjust these before
   * attaching. Optional only for backward compatibility with quizzes attached before this
   * field existed; `compute_mcq_task_score` falls back to an even share when absent. */
  points?: number;
}

// The 3 AI-generated kinds this feature can attach — separate from the older, now-unused
// 'quiz'/'assignment'/'project' placeholder values still present in the lesson_task_kind enum.
export type AiTaskKind = Extract<LessonTaskKind, 'khan_academy_video' | 'quizizz_quiz' | 'custom_mcqs'>;

export type AttachedCardContent = KhanAcademyResource | QuizizzResource | McqQuestion[];

export function useLessonAiResources(resourceId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lesson-ai-resources', resourceId],
    enabled: Boolean(resourceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_ai_resources')
        .select('*')
        .eq('resource_id', resourceId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Kicks off (or re-kicks-off) generation via the Edge Function — analyzes the lesson's
  // actual slides/title and returns once a real Khan Academy video, Quizizz quiz, and 5 MCQs
  // are ready (or failed). Invalidate regardless of outcome so the UI reflects the latest status.
  const generate = useMutation({
    mutationFn: async () => {
      if (!resourceId) throw new Error('No lesson selected.');
      const { data, error } = await supabase.functions.invoke('generate-lesson-resources', {
        body: { resourceId },
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-ai-resources', resourceId] });
    },
  });

  // Snapshots the chosen card's content into lesson_attached_tasks at the moment a teacher
  // attaches it, rather than a live reference — regenerating later must not silently change
  // what's already attached and visible to students. Mirrors the position-append logic that
  // previously lived in use-lesson-attached-tasks.ts's attachTask mutation.
  const attachCard = useMutation({
    mutationFn: async (input: { kind: AiTaskKind; content: AttachedCardContent }) => {
      if (!resourceId) throw new Error('No lesson selected.');

      const { data: latest, error: latestError } = await supabase
        .from('lesson_attached_tasks')
        .select('position')
        .eq('resource_id', resourceId)
        .order('position', { ascending: false })
        .limit(1);
      if (latestError) throw latestError;

      const nextPosition = (latest?.[0]?.position ?? 0) + 1;
      const { error } = await supabase.from('lesson_attached_tasks').insert({
        resource_id: resourceId,
        kind: input.kind,
        position: nextPosition,
        content: input.content as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-attached-tasks', resourceId] });
    },
  });

  return {
    ...query,
    generate,
    attachCard,
  };
}
