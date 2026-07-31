import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { AssignmentStatus } from '@/types/database';

export function useToggleAssignmentStatus() {
  const teacherId = useAuthStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      status,
    }: {
      assignmentId: string;
      status: AssignmentStatus;
    }) => {
      const { error } = await supabase
        .from('assignments')
        .update({ status })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments', teacherId] });
    },
  });
}
