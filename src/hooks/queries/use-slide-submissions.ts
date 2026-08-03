import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { SlideSubmission } from '@/types/database';

import type { SlideAnswers, SlideObject, SlideStroke } from './use-lesson-slides';

// A submission row plus the student's display name, embedded via the profiles FK — needed
// so the teacher's grading list can show who submitted instead of a bare student_id uuid.
export type SlideSubmissionWithStudent = SlideSubmission & {
  profiles: { full_name: string } | null;
};

// Teacher-facing: every student's submission row for a slide, to show who has completed it.
export function useSlideSubmissions(slideId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['slide-submissions', slideId],
    enabled: Boolean(slideId),
    queryFn: async (): Promise<SlideSubmissionWithStudent[]> => {
      const { data, error } = await supabase
        .from('slide_submissions')
        .select('*, profiles:student_id(full_name)')
        .eq('slide_id', slideId!);
      if (error) throw error;
      return (data ?? []) as unknown as SlideSubmissionWithStudent[];
    },
  });

  const setGrade = useMutation({
    mutationFn: async (input: {
      submissionId: string;
      grade: number | null;
      feedback?: string | null;
    }) => {
      const patch: { grade: number | null; feedback?: string | null } = { grade: input.grade };
      if ('feedback' in input) patch.feedback = input.feedback;
      const { error } = await supabase
        .from('slide_submissions')
        .update(patch)
        .eq('id', input.submissionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['slide-submissions', slideId] }),
  });

  return { ...query, setGrade };
}

// Student-facing: this student's own annotation workspace + submit toggle for a slide.
// Upserts touch only the columns passed in, so saving annotations never clobbers
// submitted_at (and vice versa) on the conflict-update path.
export function useMySlideSubmission(slideId: string | null, studentId: string | null) {
  const queryClient = useQueryClient();
  const enabled = Boolean(slideId) && Boolean(studentId);
  const queryKey = ['slide-submission', slideId, studentId];

  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async (): Promise<SlideSubmission | null> => {
      const { data, error } = await supabase
        .from('slide_submissions')
        .select('*')
        .eq('slide_id', slideId!)
        .eq('student_id', studentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveAnnotations = useMutation({
    mutationFn: async (annotations: SlideStroke[]) => {
      const { error } = await supabase.from('slide_submissions').upsert(
        {
          slide_id: slideId!,
          student_id: studentId!,
          annotations: annotations as never,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slide_id,student_id' },
      );
      if (error) throw error;
    },
  });

  const saveObjects = useMutation({
    mutationFn: async (objects: SlideObject[]) => {
      const { error } = await supabase.from('slide_submissions').upsert(
        {
          slide_id: slideId!,
          student_id: studentId!,
          objects: objects as never,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slide_id,student_id' },
      );
      if (error) throw error;
    },
  });

  // Answers to the teacher's fill-in-the-blank/multiple-choice questions, keyed by question
  // object id — same non-invalidating reasoning as the other save mutations (typing into a
  // blank shouldn't refetch and fight local state on every keystroke).
  const saveAnswers = useMutation({
    mutationFn: async (answers: SlideAnswers) => {
      const { error } = await supabase.from('slide_submissions').upsert(
        {
          slide_id: slideId!,
          student_id: studentId!,
          answers: answers as never,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slide_id,student_id' },
      );
      if (error) throw error;
    },
  });

  const setSubmitted = useMutation({
    mutationFn: async (submitted: boolean) => {
      const { error } = await supabase.from('slide_submissions').upsert(
        {
          slide_id: slideId!,
          student_id: studentId!,
          submitted_at: submitted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slide_id,student_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, saveAnnotations, saveObjects, saveAnswers, setSubmitted };
}
