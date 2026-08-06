import { useQuery } from '@tanstack/react-query';

import { autoGradeSlide } from '@/lib/slide-grading';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { Href } from 'expo-router';

import type { SlideAnswers, SlideObject } from './use-lesson-slides';

export type GradeTag = 'Marked' | 'Full marks' | 'Auto' | 'Pending';

export interface GradedItem {
  key: string;
  title: string;
  meta: string;
  updatedAt: string;
  tag: GradeTag;
  scoreLabel: string;
  percent: number | null;
  feedback: string | null;
  detail: { correct: number; total: number } | null;
  href: Href;
}

// Deep-linking to one exact slide isn't wired up today (the lesson viewer opens via
// local component state, not a URL param) — rows here open the class's Lessons view;
// legacy assignment rows open their own dedicated canvas route directly, since that
// pipeline already addresses submissions by assignment id.
export function useStudentGrades() {
  const studentId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['student-grades', studentId],
    enabled: Boolean(studentId),
    queryFn: async (): Promise<GradedItem[]> => {
      const { data: memberships, error: membershipError } = await supabase
        .from('class_members')
        .select('class_id, classes(name)')
        .eq('student_id', studentId!);
      if (membershipError) throw membershipError;
      const classIds = (memberships ?? []).map((m) => m.class_id);
      const classNameById = new Map(
        (memberships ?? []).map((m) => [
          m.class_id,
          (m.classes as { name: string } | null)?.name ?? 'Class',
        ]),
      );

      const items: GradedItem[] = [];

      if (classIds.length > 0) {
        const { data: resources, error: resourcesError } = await supabase
          .from('lesson_resources')
          .select('id, class_id, title, week_number, lesson_number')
          .in('class_id', classIds);
        if (resourcesError) throw resourcesError;
        const resourceById = new Map((resources ?? []).map((r) => [r.id, r]));
        const resourceIds = (resources ?? []).map((r) => r.id);

        const { data: slides, error: slidesError } =
          resourceIds.length > 0
            ? await supabase
                .from('lesson_slides')
                .select('id, resource_id, objects, grading_enabled')
                .in('resource_id', resourceIds)
            : { data: [], error: null };
        if (slidesError) throw slidesError;
        const slideById = new Map((slides ?? []).map((s) => [s.id, s]));
        const slideIds = (slides ?? []).map((s) => s.id);

        const { data: submissions, error: submissionsError } =
          slideIds.length > 0
            ? await supabase
                .from('slide_submissions')
                .select('id, slide_id, submitted_at, grade, feedback, answers, updated_at')
                .eq('student_id', studentId!)
                .in('slide_id', slideIds)
                .not('submitted_at', 'is', null)
            : { data: [], error: null };
        if (submissionsError) throw submissionsError;

        for (const submission of submissions ?? []) {
          const slide = slideById.get(submission.slide_id);
          const resource = slide ? resourceById.get(slide.resource_id) : null;
          if (!slide || !resource || !slide.grading_enabled) continue;

          const auto = autoGradeSlide(
            (slide.objects ?? []) as unknown as SlideObject[],
            (submission.answers ?? {}) as unknown as SlideAnswers,
          );
          const hasManualGrade = submission.grade !== null && submission.grade !== undefined;
          const percent = hasManualGrade ? submission.grade : (auto?.percent ?? null);
          const tag: GradeTag = hasManualGrade
            ? 'Marked'
            : auto
              ? auto.percent === 100
                ? 'Full marks'
                : 'Auto'
              : 'Pending';
          const scoreLabel = hasManualGrade
            ? `${submission.grade}/100`
            : auto
              ? `${auto.correct}/${auto.total}`
              : '—';

          items.push({
            key: `slide:${submission.id}`,
            title: resource.title,
            meta: `Week ${resource.week_number} · ${classNameById.get(resource.class_id) ?? 'Class'}`,
            updatedAt: submission.updated_at,
            tag,
            scoreLabel,
            percent,
            feedback: submission.feedback,
            detail: auto ? { correct: auto.correct, total: auto.total } : null,
            href: `/class/${resource.class_id}` as Href,
          });
        }

        const { data: mcqTasks, error: mcqTasksError } =
          resourceIds.length > 0
            ? await supabase
                .from('lesson_attached_tasks')
                .select('id, resource_id, position')
                .in('resource_id', resourceIds)
                .eq('kind', 'custom_mcqs')
                .order('position', { ascending: true })
            : { data: [], error: null };
        if (mcqTasksError) throw mcqTasksError;

        const quizNumberByTask = new Map<string, number>();
        const quizCounters = new Map<string, number>();
        for (const task of mcqTasks ?? []) {
          const n = (quizCounters.get(task.resource_id) ?? 0) + 1;
          quizCounters.set(task.resource_id, n);
          quizNumberByTask.set(task.id, n);
        }
        const taskIds = (mcqTasks ?? []).map((t) => t.id);

        const { data: mcqSubmissions, error: mcqSubmissionsError } =
          taskIds.length > 0
            ? await supabase
                .from('mcq_task_submissions')
                .select('id, task_id, score, correct_count, total_count, updated_at')
                .eq('student_id', studentId!)
                .in('task_id', taskIds)
            : { data: [], error: null };
        if (mcqSubmissionsError) throw mcqSubmissionsError;

        for (const submission of mcqSubmissions ?? []) {
          const task = (mcqTasks ?? []).find((t) => t.id === submission.task_id);
          const resource = task ? resourceById.get(task.resource_id) : null;
          if (!task || !resource) continue;
          const quizNumber = quizNumberByTask.get(task.id) ?? 1;

          items.push({
            key: `quiz:${submission.id}`,
            title: `${resource.title} · Quiz${quizNumber}`,
            meta: `Week ${resource.week_number} · ${classNameById.get(resource.class_id) ?? 'Class'}`,
            updatedAt: submission.updated_at,
            tag: submission.score === 100 ? 'Full marks' : 'Auto',
            scoreLabel: `${submission.correct_count}/${submission.total_count}`,
            percent: submission.score,
            feedback: null,
            detail: { correct: submission.correct_count, total: submission.total_count },
            href: `/class/${resource.class_id}` as Href,
          });
        }
      }

      const { data: legacySubmissions, error: legacyError } = await supabase
        .from('submissions')
        .select(
          'id, score, teacher_feedback, status, updated_at, assignment_id, assignments(title, classes(name))',
        )
        .eq('student_id', studentId!)
        .in('status', ['submitted', 'graded']);
      if (legacyError) throw legacyError;

      for (const submission of legacySubmissions ?? []) {
        const assignment = submission.assignments as {
          title: string;
          classes: { name: string } | null;
        } | null;
        if (submission.score === null && !submission.teacher_feedback) continue;
        items.push({
          key: `assignment:${submission.id}`,
          title: assignment?.title ?? 'Assignment',
          meta: assignment?.classes?.name ?? 'Class',
          updatedAt: submission.updated_at,
          tag: submission.status === 'graded' ? 'Marked' : 'Pending',
          scoreLabel: submission.score !== null ? String(submission.score) : '—',
          percent: null,
          feedback: submission.teacher_feedback,
          detail: null,
          href: `/canvas/${submission.assignment_id}` as Href,
        });
      }

      return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    },
  });
}
