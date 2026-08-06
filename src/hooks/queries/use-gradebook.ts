import { useQuery } from '@tanstack/react-query';

import { autoGradeSlide } from '@/lib/slide-grading';
import { supabase } from '@/lib/supabase';
import type { SlideActivityTag } from '@/types/database';

import type { SlideAnswers, SlideObject } from './use-lesson-slides';

// Short column labels for the gradebook header — "Ind Activity" is the exact label the
// naming scheme was specified with; the rest follow the same short-form convention.
const GRADEBOOK_ACTIVITY_LABELS: Record<SlideActivityTag, string> = {
  title_objectives: 'Title/Obj',
  warm_up: 'Warm Up',
  main_idea: 'Main Idea',
  solved_examples: 'Examples',
  guided_practice: 'Guided Practice',
  independent_activity: 'Ind Activity',
  group_activity: 'Group Activity',
  challenge_extra: 'Challenge',
  exit_ticket: 'Exit Ticket',
};

export interface GradebookColumn {
  id: string; // `slide:${slideId}` or `quiz:${taskId}`
  label: string; // e.g. "W1L1 Ind Activity" or "W1L1Quiz1"
  resourceId: string;
  week: number;
  lesson: number;
}

export interface GradebookRow {
  studentId: string;
  studentName: string;
  scores: Record<string, number | null>;
}

export interface GradebookData {
  columns: GradebookColumn[];
  rows: GradebookRow[];
}

// Assembles the class's real gradebook: one column per gradable item (a slide with grading
// turned on, or an attached custom-MCQs quiz), one row per student, cells are 0-100 scores
// (manual grade, auto-grade, or auto-graded quiz score) or null if not done yet. Columns are
// labeled "W{week}L{lesson} {Activity}" for slides and "W{week}L{lesson}Quiz{N}" for the
// Nth quiz attached to that lesson — matching how the same items already display to the
// student (their Grades tab, the AI-resources picker) so the two stay in sync by
// construction rather than by convention.
export function useGradebook(classId: string | null) {
  return useQuery({
    queryKey: ['gradebook', classId],
    enabled: Boolean(classId),
    queryFn: async (): Promise<GradebookData> => {
      const [rosterRes, resourcesRes] = await Promise.all([
        supabase.from('class_members').select('student_id, profiles(full_name)').eq('class_id', classId!),
        supabase
          .from('lesson_resources')
          .select('id, week_number, lesson_number, title')
          .eq('class_id', classId!),
      ]);
      if (rosterRes.error) throw rosterRes.error;
      if (resourcesRes.error) throw resourcesRes.error;

      const resources = resourcesRes.data ?? [];
      const resourceById = new Map(resources.map((r) => [r.id, r]));
      const resourceIds = resources.map((r) => r.id);

      const [slidesRes, tasksRes] = await Promise.all([
        resourceIds.length > 0
          ? supabase
              .from('lesson_slides')
              .select('id, resource_id, position, activity_tag, objects')
              .in('resource_id', resourceIds)
              .eq('grading_enabled', true)
          : Promise.resolve({ data: [], error: null }),
        resourceIds.length > 0
          ? supabase
              .from('lesson_attached_tasks')
              .select('id, resource_id, position')
              .in('resource_id', resourceIds)
              .eq('kind', 'custom_mcqs')
              .order('position', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (slidesRes.error) throw slidesRes.error;
      if (tasksRes.error) throw tasksRes.error;

      const slides = slidesRes.data ?? [];
      const tasks = tasksRes.data ?? [];
      const slideIds = slides.map((s) => s.id);
      const taskIds = tasks.map((t) => t.id);

      const [slideSubsRes, mcqSubsRes] = await Promise.all([
        slideIds.length > 0
          ? supabase
              .from('slide_submissions')
              .select('slide_id, student_id, grade, answers')
              .in('slide_id', slideIds)
              .not('submitted_at', 'is', null)
          : Promise.resolve({ data: [], error: null }),
        taskIds.length > 0
          ? supabase.from('mcq_task_submissions').select('task_id, student_id, score').in('task_id', taskIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (slideSubsRes.error) throw slideSubsRes.error;
      if (mcqSubsRes.error) throw mcqSubsRes.error;

      const slideColumns: (GradebookColumn & { sortKey: number })[] = slides.map((s) => {
        const resource = resourceById.get(s.resource_id)!;
        const label = s.activity_tag ? GRADEBOOK_ACTIVITY_LABELS[s.activity_tag] : `Slide ${s.position}`;
        return {
          id: `slide:${s.id}`,
          label: `W${resource.week_number}L${resource.lesson_number} ${label}`,
          resourceId: s.resource_id,
          week: resource.week_number,
          lesson: resource.lesson_number,
          sortKey: s.position,
        };
      });

      const quizCounters = new Map<string, number>();
      const quizColumns: (GradebookColumn & { sortKey: number })[] = tasks.map((t) => {
        const resource = resourceById.get(t.resource_id)!;
        const quizNumber = (quizCounters.get(t.resource_id) ?? 0) + 1;
        quizCounters.set(t.resource_id, quizNumber);
        return {
          id: `quiz:${t.id}`,
          label: `W${resource.week_number}L${resource.lesson_number}Quiz${quizNumber}`,
          resourceId: t.resource_id,
          week: resource.week_number,
          lesson: resource.lesson_number,
          sortKey: t.position + 1000, // quizzes sort after slides within the same lesson
        };
      });

      const columns = [...slideColumns, ...quizColumns]
        .sort((a, b) =>
          a.week !== b.week ? a.week - b.week : a.lesson !== b.lesson ? a.lesson - b.lesson : a.sortKey - b.sortKey,
        )
        .map(({ sortKey: _sortKey, ...rest }) => rest);

      const slideById = new Map(slides.map((s) => [s.id, s]));
      const scoreByCell = new Map<string, number>();
      for (const sub of slideSubsRes.data ?? []) {
        const slide = slideById.get(sub.slide_id);
        if (!slide) continue;
        const hasManualGrade = sub.grade !== null && sub.grade !== undefined;
        const percent = hasManualGrade
          ? sub.grade!
          : (autoGradeSlide(
              (slide.objects ?? []) as unknown as SlideObject[],
              (sub.answers ?? {}) as unknown as SlideAnswers,
            )?.percent ?? null);
        if (percent !== null) scoreByCell.set(`slide:${slide.id}:${sub.student_id}`, percent);
      }
      for (const sub of mcqSubsRes.data ?? []) {
        scoreByCell.set(`quiz:${sub.task_id}:${sub.student_id}`, sub.score);
      }

      const rows: GradebookRow[] = (rosterRes.data ?? [])
        .map((r) => {
          const profile = r.profiles as { full_name: string } | null;
          const scores: Record<string, number | null> = {};
          for (const col of columns) {
            const key = `${col.id}:${r.student_id}`;
            scores[col.id] = scoreByCell.has(key) ? scoreByCell.get(key)! : null;
          }
          return { studentId: r.student_id, studentName: profile?.full_name ?? 'Student', scores };
        })
        .sort((a, b) => a.studentName.localeCompare(b.studentName));

      return { columns, rows };
    },
  });
}
