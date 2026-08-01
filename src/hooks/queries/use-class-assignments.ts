import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Assignment, SubmissionStatus } from '@/types/database';

export type ClassAssignment = Assignment & { submissions: { status: SubmissionStatus }[] };

/** Assignments scoped to a single class, plus how many submitted-but-ungraded
 * responses are waiting across all of them (drives the "N Pending" badges on
 * the class activity screen). */
export function useClassAssignments(classId: string) {
  const query = useQuery({
    queryKey: ['class-assignments', classId],
    queryFn: async (): Promise<ClassAssignment[]> => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, submissions(status)')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClassAssignment[];
    },
  });

  const assignments = query.data ?? [];
  const pendingGradingCount = assignments.reduce(
    (sum, assignment) =>
      sum + assignment.submissions.filter((s) => s.status === 'submitted').length,
    0,
  );

  return { ...query, assignments, pendingGradingCount };
}
