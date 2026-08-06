import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// Mutations for the parts of the gradebook a teacher directly authors: extra columns they
// add themselves, the manually-entered scores in them, and the class's saved column order.
// Reading the assembled grid (these plus the auto-derived slide/quiz columns) lives in
// use-gradebook.ts — this file is write-only, on purpose, so there's one source of truth for
// "what does the grid look like" and one for "how does a teacher change it."
export function useGradebookColumns(classId: string | null) {
  const queryClient = useQueryClient();
  const invalidateGradebook = () =>
    queryClient.invalidateQueries({ queryKey: ['gradebook', classId] });

  const createColumn = useMutation({
    mutationFn: async (label: string) => {
      const { error } = await supabase
        .from('gradebook_custom_columns')
        .insert({ class_id: classId!, label });
      if (error) throw error;
    },
    onSuccess: invalidateGradebook,
  });

  const renameColumn = useMutation({
    mutationFn: async (input: { id: string; label: string }) => {
      const { error } = await supabase
        .from('gradebook_custom_columns')
        .update({ label: input.label, updated_at: new Date().toISOString() })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: invalidateGradebook,
  });

  const deleteColumn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gradebook_custom_columns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateGradebook,
  });

  const setScore = useMutation({
    mutationFn: async (input: { columnId: string; studentId: string; score: number | null }) => {
      const { error } = await supabase.from('gradebook_custom_scores').upsert(
        {
          column_id: input.columnId,
          student_id: input.studentId,
          score: input.score,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'column_id,student_id' },
      );
      if (error) throw error;
    },
    onSuccess: invalidateGradebook,
  });

  const setColumnOrder = useMutation({
    mutationFn: async (order: string[]) => {
      const { error } = await supabase.from('gradebook_layouts').upsert(
        { class_id: classId!, column_order: order as never, updated_at: new Date().toISOString() },
        { onConflict: 'class_id' },
      );
      if (error) throw error;
    },
    onSuccess: invalidateGradebook,
  });

  return { createColumn, renameColumn, deleteColumn, setScore, setColumnOrder };
}
