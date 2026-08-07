import { useQuery } from '@tanstack/react-query';

import { autoGradeSlide } from '@/lib/slide-grading';
import { supabase } from '@/lib/supabase';
import type { SlideActivityTag } from '@/types/database';

import type { SlideAnswers, SlideObject } from './use-lesson-slides';

export interface WeekActivity {
  slideId: string;
  resourceId: string;
  /** 0-based index within the resource's full slide list — what SlideViewerModal's
   * `startIndex` expects — not the index among just the gradable slides. */
  slideIndex: number;
  activityTag: SlideActivityTag | null;
  submitted: boolean;
  grade: number | null;
}

// Flat list of submission-enabled slides ("activities to respond to") across every
// resource in one open week, for the student's Week Detail split view.
export function useWeekActivities(resourceIds: string[], studentId: string | null) {
  const key = resourceIds.slice().sort().join(',');

  return useQuery({
    queryKey: ['week-activities', key, studentId],
    enabled: resourceIds.length > 0 && Boolean(studentId),
    queryFn: async (): Promise<WeekActivity[]> => {
      const { data: allSlides, error } = await supabase
        .from('lesson_slides')
        .select(
          'id, resource_id, position, activity_tag, submissions_enabled, grading_enabled, grading_mode, objects',
        )
        .in('resource_id', resourceIds);
      if (error) throw error;

      const byResource = new Map<string, typeof allSlides>();
      for (const slide of allSlides ?? []) {
        const list = byResource.get(slide.resource_id) ?? [];
        list.push(slide);
        byResource.set(slide.resource_id, list);
      }
      for (const list of byResource.values()) list.sort((a, b) => a.position - b.position);

      const gradable = (allSlides ?? []).filter((s) => s.submissions_enabled);
      const slideIds = gradable.map((s) => s.id);

      const { data: submissions, error: submissionsError } =
        slideIds.length > 0
          ? await supabase
              .from('slide_submissions')
              .select('slide_id, submitted_at, grade, answers')
              .eq('student_id', studentId!)
              .in('slide_id', slideIds)
          : { data: [], error: null };
      if (submissionsError) throw submissionsError;
      const submissionBySlide = new Map((submissions ?? []).map((s) => [s.slide_id, s]));

      return gradable.map((slide) => {
        const submission = submissionBySlide.get(slide.id);
        const resourceSlides = byResource.get(slide.resource_id) ?? [];
        // Mode is authoritative, not just "is there a manual grade" — same gating as
        // Gradebook/StudentGradePanel, so this card's badge can never show a stale manual
        // grade left over from before a teacher switched the slide to Auto (or vice versa).
        const gradeValue = !slide.grading_enabled
          ? null
          : slide.grading_mode === 'manual'
            ? (submission?.grade ?? null)
            : (autoGradeSlide(
                (slide.objects ?? []) as unknown as SlideObject[],
                (submission?.answers ?? {}) as unknown as SlideAnswers,
              )?.percent ?? null);
        return {
          slideId: slide.id,
          resourceId: slide.resource_id,
          slideIndex: Math.max(
            0,
            resourceSlides.findIndex((s) => s.id === slide.id),
          ),
          activityTag: slide.activity_tag,
          submitted: Boolean(submission?.submitted_at),
          grade: gradeValue,
        };
      });
    },
  });
}
