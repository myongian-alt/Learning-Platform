import { useQuery } from '@tanstack/react-query';

import { autoGradeSlide } from '@/lib/slide-grading';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { ClassRow } from '@/types/database';

import type { SlideAnswers, SlideObject } from './use-lesson-slides';

export interface ClassWithProgress extends ClassRow {
  percentComplete: number;
  completedSlides: number;
  totalSlides: number;
}

export interface DueSoonItem {
  classId: string;
  className: string;
  resourceId: string;
  resourceTitle: string;
  slideId: string;
}

export interface StudentBadge {
  key: string;
  label: string;
  earned: boolean;
}

export interface WeeklyActivityBucket {
  label: string;
  count: number;
}

export interface StudentDashboardData {
  classes: ClassWithProgress[];
  dueSoon: DueSoonItem[];
  averageScore: number | null;
  streak: number;
  badges: StudentBadge[];
  weeklyActivity: WeeklyActivityBucket[];
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

// 8 rolling 7-day buckets, oldest first, index 7 (last) being the current week — a
// lightweight stand-in for a real per-term-week chart, since submission dates don't
// carry a week number themselves (only lesson_resources.week_number does, which is
// about content organization, not when the student actually did the work).
function computeWeeklyActivity(submittedDates: string[]): WeeklyActivityBucket[] {
  const buckets = Array.from({ length: 8 }, (_, i) => ({ label: String(i + 1), count: 0 }));
  const now = Date.now();
  for (const iso of submittedDates) {
    const daysAgo = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
    const weekIndex = Math.floor(daysAgo / 7);
    if (weekIndex >= 0 && weekIndex < 8) buckets[7 - weekIndex].count += 1;
  }
  return buckets;
}

// Longest run of consecutive calendar days (student's local timezone) ending today or
// yesterday — a streak that hasn't been kept up today doesn't silently show as broken
// until the student has actually missed a full day.
function computeStreak(submittedDates: string[]): number {
  const days = new Set(submittedDates.map(dayKey));
  let cursor = new Date();
  let streak = 0;
  const cursorKey = () => cursor.toISOString().slice(0, 10);
  if (!days.has(cursorKey())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursorKey())) return 0;
  }
  while (days.has(cursorKey())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function useStudentDashboard() {
  const studentId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['student-dashboard', studentId],
    enabled: Boolean(studentId),
    queryFn: async (): Promise<StudentDashboardData> => {
      const { data: memberships, error: membershipError } = await supabase
        .from('class_members')
        .select('classes(*)')
        .eq('student_id', studentId!);
      if (membershipError) throw membershipError;

      const classes = (memberships ?? [])
        .map((m) => m.classes)
        .filter((c): c is ClassRow => c !== null);
      if (classes.length === 0) {
        return {
          classes: [],
          dueSoon: [],
          averageScore: null,
          streak: 0,
          badges: emptyBadges(),
          weeklyActivity: computeWeeklyActivity([]),
        };
      }
      const classIds = classes.map((c) => c.id);

      const { data: resources, error: resourcesError } = await supabase
        .from('lesson_resources')
        .select('id, class_id, title')
        .in('class_id', classIds);
      if (resourcesError) throw resourcesError;
      const resourceIds = (resources ?? []).map((r) => r.id);
      const resourceById = new Map((resources ?? []).map((r) => [r.id, r]));

      const { data: slides, error: slidesError } =
        resourceIds.length > 0
          ? await supabase
              .from('lesson_slides')
              .select('id, resource_id, submissions_enabled, grading_enabled, objects')
              .in('resource_id', resourceIds)
              .eq('submissions_enabled', true)
          : { data: [], error: null };
      if (slidesError) throw slidesError;
      const slideIds = (slides ?? []).map((s) => s.id);

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
      const classNameById = new Map(classes.map((c) => [c.id, c.name]));

      const dueSoon: DueSoonItem[] = [];
      const percentByClass = new Map<string, { done: number; total: number }>();
      const scores: number[] = [];
      const submittedDates: string[] = [];
      const submittedHours: number[] = [];

      for (const slide of slides ?? []) {
        const resource = resourceById.get(slide.resource_id);
        if (!resource) continue;
        const bucket = percentByClass.get(resource.class_id) ?? { done: 0, total: 0 };
        bucket.total += 1;
        const submission = submissionBySlide.get(slide.id);
        const submitted = Boolean(submission?.submitted_at);
        if (submitted) {
          bucket.done += 1;
          submittedDates.push(submission!.submitted_at!);
          submittedHours.push(new Date(submission!.submitted_at!).getHours());

          if (slide.grading_enabled) {
            if (submission!.grade !== null && submission!.grade !== undefined) {
              scores.push(submission!.grade);
            } else {
              const auto = autoGradeSlide(
                (slide.objects ?? []) as unknown as SlideObject[],
                (submission!.answers ?? {}) as unknown as SlideAnswers,
              );
              if (auto) scores.push(auto.percent);
            }
          }
        } else {
          dueSoon.push({
            classId: resource.class_id,
            className: classNameById.get(resource.class_id) ?? 'Class',
            resourceId: resource.id,
            resourceTitle: resource.title,
            slideId: slide.id,
          });
        }
        percentByClass.set(resource.class_id, bucket);
      }

      const classesWithProgress: ClassWithProgress[] = classes.map((c) => {
        const bucket = percentByClass.get(c.id);
        return {
          ...c,
          percentComplete:
            bucket && bucket.total > 0 ? Math.round((bucket.done / bucket.total) * 100) : 0,
          completedSlides: bucket?.done ?? 0,
          totalSlides: bucket?.total ?? 0,
        };
      });

      const streak = computeStreak(submittedDates);
      const averageScore =
        scores.length > 0
          ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
          : null;

      const badges: StudentBadge[] = [
        { key: 'consistent', label: 'Consistent Learner', earned: streak >= 5 },
        {
          key: 'quiz-ace',
          label: 'Quiz Ace',
          earned: scores.length >= 3 && (averageScore ?? 0) >= 90,
        },
        {
          key: 'early-bird',
          label: 'Early Bird',
          earned: submittedHours.filter((h) => h < 9).length >= 3,
        },
      ];

      return {
        classes: classesWithProgress,
        dueSoon: dueSoon.slice(0, 6),
        averageScore,
        streak,
        badges,
        weeklyActivity: computeWeeklyActivity(submittedDates),
      };
    },
  });
}

function emptyBadges(): StudentBadge[] {
  return [
    { key: 'consistent', label: 'Consistent Learner', earned: false },
    { key: 'quiz-ace', label: 'Quiz Ace', earned: false },
    { key: 'early-bird', label: 'Early Bird', earned: false },
  ];
}
