import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { LessonTaskKind } from '@/types/database';

export function useLessonAttachedTasks(resourceId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lesson-attached-tasks', resourceId],
    enabled: Boolean(resourceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_attached_tasks')
        .select('*')
        .eq('resource_id', resourceId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const attachTask = useMutation({
    mutationFn: async (kind: LessonTaskKind) => {
      if (!resourceId) throw new Error('No lesson selected.');

      const { data: latest, error: latestError } = await supabase
        .from('lesson_attached_tasks')
        .select('position')
        .eq('resource_id', resourceId)
        .order('position', { ascending: false })
        .limit(1);
      if (latestError) throw latestError;

      const nextPosition = (latest?.[0]?.position ?? 0) + 1;
      const { error } = await supabase
        .from('lesson_attached_tasks')
        .insert({ resource_id: resourceId, kind, position: nextPosition });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-attached-tasks', resourceId] });
    },
  });

  const removeTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!resourceId) throw new Error('No lesson selected.');

      const { error } = await supabase.from('lesson_attached_tasks').delete().eq('id', taskId);
      if (error) throw error;

      const { data: remaining, error: fetchError } = await supabase
        .from('lesson_attached_tasks')
        .select('id,position')
        .eq('resource_id', resourceId)
        .order('position', { ascending: true });
      if (fetchError) throw fetchError;

      // Two-phase rewrite avoids unique conflicts on (resource_id, position).
      for (let i = 0; i < (remaining ?? []).length; i += 1) {
        const phase1 = await supabase
          .from('lesson_attached_tasks')
          .update({ position: i + 1 + 1000 })
          .eq('id', remaining![i].id);
        if (phase1.error) throw phase1.error;
      }
      for (let i = 0; i < (remaining ?? []).length; i += 1) {
        const phase2 = await supabase
          .from('lesson_attached_tasks')
          .update({ position: i + 1 })
          .eq('id', remaining![i].id);
        if (phase2.error) throw phase2.error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-attached-tasks', resourceId] });
    },
  });

  return {
    ...query,
    attachTask,
    removeTask,
  };
}
