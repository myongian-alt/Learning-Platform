import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';

export function useCreateAssignment() {
  const teacherId = useAuthStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classId,
      title,
      weekNumber,
    }: {
      classId: string;
      title: string;
      weekNumber?: number;
    }) => {
      const { data: assignment, error } = await supabase
        .from('assignments')
        .insert({
          class_id: classId,
          created_by: teacherId!,
          title,
          status: 'draft',
          week_number: weekNumber,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: pageError } = await supabase
        .from('assignment_pages')
        .insert({ assignment_id: assignment.id, position: 0, source_type: 'blank_canvas' });
      if (pageError) throw pageError;

      return assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments', teacherId] });
    },
  });
}
