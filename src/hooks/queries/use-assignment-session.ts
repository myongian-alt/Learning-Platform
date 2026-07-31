import { useMutation, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { Assignment, AssignmentPage, StrokePoint } from '@/types/database';

export type AssignmentWithPages = Assignment & { assignment_pages: AssignmentPage[] };

export function useAssignmentSession(assignmentId: string) {
  const studentId = useAuthStore((s) => s.session?.user.id);

  const assignmentQuery = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: async (): Promise<AssignmentWithPages> => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, assignment_pages(*)')
        .eq('id', assignmentId)
        .order('position', { referencedTable: 'assignment_pages', ascending: true })
        .single();
      if (error) throw error;
      return data as unknown as AssignmentWithPages;
    },
  });

  const submissionQuery = useQuery({
    queryKey: ['submission', assignmentId, studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId!)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;

      const { data: created, error: insertError } = await supabase
        .from('submissions')
        .insert({
          assignment_id: assignmentId,
          student_id: studentId!,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (insertError) throw insertError;
      return created;
    },
  });

  const raiseHand = useMutation({
    mutationFn: async (pageId: string | null) => {
      const { error } = await supabase
        .from('help_requests')
        .insert({ assignment_id: assignmentId, student_id: studentId!, page_id: pageId });
      if (error) throw error;
    },
  });

  const saveStroke = useMutation({
    mutationFn: async (input: {
      pageId: string;
      submissionId: string;
      color: string;
      strokeWidth: number;
      points: StrokePoint[];
    }) => {
      const { error } = await supabase.from('canvas_strokes').insert({
        page_id: input.pageId,
        submission_id: input.submissionId,
        author_id: studentId!,
        author_role: 'student',
        tool: 'pen',
        color: input.color,
        stroke_width: input.strokeWidth,
        points: input.points,
      });
      if (error) throw error;
    },
  });

  return { assignmentQuery, submissionQuery, raiseHand, saveStroke };
}
