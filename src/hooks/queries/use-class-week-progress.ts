import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface WeekProgress {
  resourceCount: number;
  percentComplete: number | null;
}

// Per-week lock/progress for the student's week-folder grid: locked = no lesson
// resources posted for that week yet; progress = submitted / submission-enabled
// slides in that week (null when the week has no gradable activities at all, so the
// folder card shows no bar rather than a misleading full one).
export function useClassWeekProgress(classId: string, studentId: string | null) {
  return useQuery({
    queryKey: ['class-week-progress', classId, studentId],
    enabled: Boolean(classId) && Boolean(studentId),
    queryFn: async (): Promise<Map<number, WeekProgress>> => {
      const { data: resources, error } = await supabase
        .from('lesson_resources')
        .select('id, week_number')
        .eq('class_id', classId);
      if (error) throw error;

      const weekByResource = new Map((resources ?? []).map((r) => [r.id, r.week_number]));
      const resourceCountByWeek = new Map<number, number>();
      for (const r of resources ?? []) {
        resourceCountByWeek.set(r.week_number, (resourceCountByWeek.get(r.week_number) ?? 0) + 1);
      }
      const resourceIds = (resources ?? []).map((r) => r.id);

      const { data: slides, error: slidesError } =
        resourceIds.length > 0
          ? await supabase
              .from('lesson_slides')
              .select('id, resource_id')
              .in('resource_id', resourceIds)
              .eq('submissions_enabled', true)
          : { data: [], error: null };
      if (slidesError) throw slidesError;
      const slideIds = (slides ?? []).map((s) => s.id);

      const { data: submissions, error: submissionsError } =
        slideIds.length > 0
          ? await supabase
              .from('slide_submissions')
              .select('slide_id, submitted_at')
              .eq('student_id', studentId!)
              .in('slide_id', slideIds)
          : { data: [], error: null };
      if (submissionsError) throw submissionsError;
      const submittedSlideIds = new Set(
        (submissions ?? []).filter((s) => s.submitted_at).map((s) => s.slide_id),
      );

      const totalByWeek = new Map<number, number>();
      const doneByWeek = new Map<number, number>();
      for (const slide of slides ?? []) {
        const week = weekByResource.get(slide.resource_id);
        if (week === undefined) continue;
        totalByWeek.set(week, (totalByWeek.get(week) ?? 0) + 1);
        if (submittedSlideIds.has(slide.id)) doneByWeek.set(week, (doneByWeek.get(week) ?? 0) + 1);
      }

      const result = new Map<number, WeekProgress>();
      for (const [week, resourceCount] of resourceCountByWeek) {
        const total = totalByWeek.get(week) ?? 0;
        const done = doneByWeek.get(week) ?? 0;
        result.set(week, {
          resourceCount,
          percentComplete: total > 0 ? Math.round((done / total) * 100) : null,
        });
      }
      return result;
    },
  });
}
