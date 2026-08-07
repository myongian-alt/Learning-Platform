import { useQuery } from '@tanstack/react-query';

import { autoGradeSlide } from '@/lib/slide-grading';
import { supabase } from '@/lib/supabase';
import type { SlideActivityTag, SlideGradingMode } from '@/types/database';

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
  id: string; // `slide:${slideId}`, `quiz:${taskId}`, or `custom:${columnId}`
  label: string; // e.g. "W1L1 Ind Activity", "W1L1Quiz1", or a teacher-chosen name
  kind: 'slide' | 'quiz' | 'custom';
  /** Only present for auto-derived (slide/quiz) columns. */
  resourceId?: string;
  week?: number;
  lesson?: number;
  /** Only present for `kind: 'slide'` — whether the slide is set to Auto or Manual grading
   * (quiz columns are always server-auto-scored; custom columns have no such concept). */
  gradingMode?: SlideGradingMode;
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

type GradableSlideRow = {
  id: string;
  resource_id: string;
  position: number;
  activity_tag: SlideActivityTag | null;
  objects: unknown;
  grading_mode: SlideGradingMode;
};

type QuizTaskRow = { id: string; resource_id: string; position: number };

// Any column not present in the class's saved order (a brand-new slide graded today, or a
// column order that predates a just-added custom column) is appended at the end in its
// natural default order — the saved order only needs to capture explicit overrides.
function applyColumnOrder(
  naturalColumns: GradebookColumn[],
  storedOrder: string[],
): GradebookColumn[] {
  const byId = new Map(naturalColumns.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const ordered: GradebookColumn[] = [];
  for (const id of storedOrder) {
    const col = byId.get(id);
    if (col && !seen.has(id)) {
      ordered.push(col);
      seen.add(id);
    }
  }
  for (const col of naturalColumns) {
    if (!seen.has(col.id)) ordered.push(col);
  }
  return ordered;
}

// The column-building half of the gradebook — every gradable item (a slide with grading
// turned on, an attached custom-MCQs quiz, or a teacher-added custom column), labeled and
// ordered exactly the same way regardless of who's asking. Shared by the teacher's full-roster
// useGradebook below and the student's own-row-only useMyGradebook, so the two can never
// visually disagree about what a column is called or where it sits — the only thing that
// differs between them is whose scores go in the rows.
async function fetchGradebookColumns(classId: string): Promise<{
  columns: GradebookColumn[];
  slideById: Map<string, GradableSlideRow>;
  quizTaskIds: string[];
}> {
  const [resourcesRes, customColumnsRes, layoutRes] = await Promise.all([
    supabase
      .from('lesson_resources')
      .select('id, week_number, lesson_number, title')
      .eq('class_id', classId),
    supabase
      .from('gradebook_custom_columns')
      .select('id, label')
      .eq('class_id', classId)
      .order('created_at', { ascending: true }),
    supabase.from('gradebook_layouts').select('column_order').eq('class_id', classId).maybeSingle(),
  ]);
  if (resourcesRes.error) throw resourcesRes.error;
  if (customColumnsRes.error) throw customColumnsRes.error;
  if (layoutRes.error) throw layoutRes.error;

  const resources = resourcesRes.data ?? [];
  const resourceById = new Map(resources.map((r) => [r.id, r]));
  const resourceIds = resources.map((r) => r.id);

  const [slidesRes, tasksRes] = await Promise.all([
    resourceIds.length > 0
      ? supabase
          .from('lesson_slides')
          .select('id, resource_id, position, activity_tag, objects, grading_mode')
          .in('resource_id', resourceIds)
          .eq('grading_enabled', true)
      : Promise.resolve({ data: [] as GradableSlideRow[], error: null }),
    resourceIds.length > 0
      ? supabase
          .from('lesson_attached_tasks')
          .select('id, resource_id, position')
          .in('resource_id', resourceIds)
          .eq('kind', 'custom_mcqs')
          .order('position', { ascending: true })
      : Promise.resolve({ data: [] as QuizTaskRow[], error: null }),
  ]);
  if (slidesRes.error) throw slidesRes.error;
  if (tasksRes.error) throw tasksRes.error;

  const slides = slidesRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const customColumns = customColumnsRes.data ?? [];

  const slideColumns: (GradebookColumn & { sortKey: number })[] = slides.map((s) => {
    const resource = resourceById.get(s.resource_id)!;
    const label = s.activity_tag
      ? GRADEBOOK_ACTIVITY_LABELS[s.activity_tag]
      : `Slide ${s.position}`;
    return {
      id: `slide:${s.id}`,
      label: `W${resource.week_number}L${resource.lesson_number} ${label}`,
      kind: 'slide',
      resourceId: s.resource_id,
      week: resource.week_number,
      lesson: resource.lesson_number,
      gradingMode: s.grading_mode,
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
      kind: 'quiz',
      resourceId: t.resource_id,
      week: resource.week_number,
      lesson: resource.lesson_number,
      sortKey: t.position + 1000, // quizzes sort after slides within the same lesson
    };
  });

  const customCols: (GradebookColumn & { sortKey: number })[] = customColumns.map((c, i) => ({
    id: `custom:${c.id}`,
    label: c.label,
    kind: 'custom',
    sortKey: 1_000_000 + i, // custom columns default to the far right
  }));

  const naturalColumns = [...slideColumns, ...quizColumns, ...customCols]
    .sort((a, b) => {
      const weekA = a.week ?? Infinity;
      const weekB = b.week ?? Infinity;
      if (weekA !== weekB) return weekA - weekB;
      const lessonA = a.lesson ?? Infinity;
      const lessonB = b.lesson ?? Infinity;
      if (lessonA !== lessonB) return lessonA - lessonB;
      return a.sortKey - b.sortKey;
    })
    .map(({ sortKey: _sortKey, ...rest }) => rest);

  const storedOrder = (layoutRes.data?.column_order as string[] | undefined) ?? [];
  const columns = applyColumnOrder(naturalColumns, storedOrder);

  return {
    columns,
    slideById: new Map(slides.map((s) => [s.id, s])),
    quizTaskIds: tasks.map((t) => t.id),
  };
}

// Resolves one slide submission's percent under its slide's grading_mode — mode is
// authoritative, not just "is there a manual grade": a Manual slide only ever shows what the
// teacher explicitly set (even if it happens to have gradable objects), and an Auto slide
// always shows the live-recomputed percent (even if it was manually graded before a teacher
// switched it to Auto) — see the grading_mode migration.
function slideSubmissionPercent(
  slide: GradableSlideRow,
  sub: { grade: number | null; answers: unknown },
): number | null {
  if (slide.grading_mode === 'manual') return sub.grade ?? null;
  return (
    autoGradeSlide(
      (slide.objects ?? []) as unknown as SlideObject[],
      (sub.answers ?? {}) as unknown as SlideAnswers,
    )?.percent ?? null
  );
}

// Assembles the class's real gradebook: one column per gradable item, one row per student,
// cells are 0-100 scores or null if not done yet. Auto-derived columns are labeled
// "W{week}L{lesson} {Activity}"/"W{week}L{lesson}Quiz{N}" — matching how the same items
// already display to the student (their Grades tab, the AI-resources picker) so the two stay
// in sync by construction rather than by convention.
export function useGradebook(classId: string | null) {
  return useQuery({
    queryKey: ['gradebook', classId],
    enabled: Boolean(classId),
    queryFn: async (): Promise<GradebookData> => {
      const [{ columns, slideById, quizTaskIds }, rosterRes] = await Promise.all([
        fetchGradebookColumns(classId!),
        supabase
          .from('class_members')
          .select('student_id, profiles(full_name)')
          .eq('class_id', classId!),
      ]);
      if (rosterRes.error) throw rosterRes.error;

      const slideIds = Array.from(slideById.keys());
      const customColumnIds = columns
        .filter((c) => c.kind === 'custom')
        .map((c) => c.id.replace('custom:', ''));

      const [slideSubsRes, mcqSubsRes, customScoresRes] = await Promise.all([
        slideIds.length > 0
          ? supabase
              .from('slide_submissions')
              .select('slide_id, student_id, grade, answers')
              .in('slide_id', slideIds)
              .not('submitted_at', 'is', null)
          : Promise.resolve({ data: [], error: null }),
        quizTaskIds.length > 0
          ? supabase
              .from('mcq_task_submissions')
              .select('task_id, student_id, score')
              .in('task_id', quizTaskIds)
          : Promise.resolve({ data: [], error: null }),
        customColumnIds.length > 0
          ? supabase
              .from('gradebook_custom_scores')
              .select('column_id, student_id, score')
              .in('column_id', customColumnIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (slideSubsRes.error) throw slideSubsRes.error;
      if (mcqSubsRes.error) throw mcqSubsRes.error;
      if (customScoresRes.error) throw customScoresRes.error;

      const scoreByCell = new Map<string, number>();
      for (const sub of slideSubsRes.data ?? []) {
        const slide = slideById.get(sub.slide_id);
        if (!slide) continue;
        const percent = slideSubmissionPercent(slide, sub);
        if (percent !== null) scoreByCell.set(`slide:${slide.id}:${sub.student_id}`, percent);
      }
      for (const sub of mcqSubsRes.data ?? []) {
        scoreByCell.set(`quiz:${sub.task_id}:${sub.student_id}`, sub.score);
      }
      for (const sub of customScoresRes.data ?? []) {
        if (sub.score !== null && sub.score !== undefined) {
          scoreByCell.set(`custom:${sub.column_id}:${sub.student_id}`, Number(sub.score));
        }
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

// The student's own gradebook: the exact same columns (label/order) a teacher would see, but
// only ever this one student's row — RLS already scopes slide_submissions/
// mcq_task_submissions/gradebook_custom_scores to a caller's own rows, but this hook also
// explicitly filters by studentId so it never depends on that alone.
export function useMyGradebook(classId: string | null, studentId: string | null) {
  return useQuery({
    queryKey: ['my-gradebook', classId, studentId],
    enabled: Boolean(classId) && Boolean(studentId),
    queryFn: async (): Promise<GradebookData> => {
      const { columns, slideById, quizTaskIds } = await fetchGradebookColumns(classId!);

      const slideIds = Array.from(slideById.keys());
      const customColumnIds = columns
        .filter((c) => c.kind === 'custom')
        .map((c) => c.id.replace('custom:', ''));

      const [slideSubsRes, mcqSubsRes, customScoresRes] = await Promise.all([
        slideIds.length > 0
          ? supabase
              .from('slide_submissions')
              .select('slide_id, grade, answers')
              .eq('student_id', studentId!)
              .in('slide_id', slideIds)
              .not('submitted_at', 'is', null)
          : Promise.resolve({ data: [], error: null }),
        quizTaskIds.length > 0
          ? supabase
              .from('mcq_task_submissions')
              .select('task_id, score')
              .eq('student_id', studentId!)
              .in('task_id', quizTaskIds)
          : Promise.resolve({ data: [], error: null }),
        customColumnIds.length > 0
          ? supabase
              .from('gradebook_custom_scores')
              .select('column_id, score')
              .eq('student_id', studentId!)
              .in('column_id', customColumnIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (slideSubsRes.error) throw slideSubsRes.error;
      if (mcqSubsRes.error) throw mcqSubsRes.error;
      if (customScoresRes.error) throw customScoresRes.error;

      const scores: Record<string, number | null> = {};
      for (const col of columns) scores[col.id] = null;
      for (const sub of slideSubsRes.data ?? []) {
        const slide = slideById.get(sub.slide_id);
        if (!slide) continue;
        const percent = slideSubmissionPercent(slide, sub);
        if (percent !== null) scores[`slide:${slide.id}`] = percent;
      }
      for (const sub of mcqSubsRes.data ?? []) {
        scores[`quiz:${sub.task_id}`] = sub.score;
      }
      for (const sub of customScoresRes.data ?? []) {
        if (sub.score !== null && sub.score !== undefined)
          scores[`custom:${sub.column_id}`] = Number(sub.score);
      }

      return {
        columns,
        rows: [{ studentId: studentId!, studentName: '', scores }],
      };
    },
  });
}
