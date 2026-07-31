import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { Assignment } from '@/types/database';

export type TeacherAssignment = Assignment & {
  classes: { name: string } | null;
  submissions: { count: number }[];
  help_requests: { count: number }[];
};

export function useTeacherAssignments() {
  const teacherId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['teacher-assignments', teacherId],
    enabled: Boolean(teacherId),
    queryFn: async (): Promise<TeacherAssignment[]> => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, classes(name), submissions(count), help_requests(count)')
        .eq('created_by', teacherId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TeacherAssignment[];
    },
  });
}
