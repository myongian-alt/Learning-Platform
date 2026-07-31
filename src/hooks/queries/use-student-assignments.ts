import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { Assignment, Submission } from '@/types/database';

export interface StudentAssignment extends Assignment {
  class_name: string;
  submission: Submission | null;
}

export function useStudentAssignments() {
  const studentId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['student-assignments', studentId],
    enabled: Boolean(studentId),
    queryFn: async (): Promise<StudentAssignment[]> => {
      const { data: memberships, error: membershipError } = await supabase
        .from('class_members')
        .select('class_id')
        .eq('student_id', studentId!);
      if (membershipError) throw membershipError;

      const classIds = memberships?.map((m) => m.class_id) ?? [];
      if (classIds.length === 0) return [];

      const { data, error } = await supabase
        .from('assignments')
        .select('*, classes(name), submissions(*)')
        .in('class_id', classIds)
        .eq('status', 'published')
        .order('due_at', { ascending: true, nullsFirst: false });
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        ...row,
        class_name: row.classes?.name ?? 'Class',
        submission: row.submissions?.find((s: Submission) => s.student_id === studentId) ?? null,
      }));
    },
  });
}
