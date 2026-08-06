import { useQuery } from '@tanstack/react-query';

import { autoGradeSlide } from '@/lib/slide-grading';
import { supabase } from '@/lib/supabase';
import type { SlideActivityTag } from '@/types/database';

import type { SlideAnswers, SlideObject } from './use-lesson-slides';

const ACTIVITY_TAG_LABELS: Record<SlideActivityTag, string> = {
  title_objectives: 'Title/Obj',
  warm_up: 'Warm Up',
  main_idea: 'Main Idea',
  solved_examples: 'Examples',
  guided_practice: 'Guided Practice',
  independent_activity: 'Independent',
  group_activity: 'Group Work',
  challenge_extra: 'Challenge',
  exit_ticket: 'Exit Ticket',
};

const HEATMAP_DAYS = 63; // 9 rolling weeks, GitHub-contributions style
const TREND_WEEKS = 8;
const AT_RISK_SCORE_THRESHOLD = 70;
const AT_RISK_INACTIVITY_DAYS = 7;

export interface ReportKpis {
  classAverage: number | null;
  completionRate: number; // 0-100
  totalSubmissions: number;
  atRiskCount: number;
  studentCount: number;
}

export interface TrendPoint {
  label: string; // "8 wks ago" .. "This wk"
  avgScore: number | null;
  count: number;
}

export interface DistributionBucket {
  label: string;
  count: number;
  color: string;
}

export interface RadarAxis {
  key: string;
  label: string;
  avgScore: number | null;
}

export interface LeaderboardEntry {
  studentId: string;
  name: string;
  avgScore: number | null;
  completed: number;
  total: number;
}

export interface HeatmapDay {
  date: string; // yyyy-mm-dd
  count: number;
}

export interface AtRiskStudent {
  studentId: string;
  name: string;
  avgScore: number | null;
  completed: number;
  total: number;
  daysSinceActive: number | null;
  reasons: string[];
}

export interface ClassReportsData {
  kpis: ReportKpis;
  trend: TrendPoint[];
  distribution: DistributionBucket[];
  radar: RadarAxis[];
  leaderboard: LeaderboardEntry[];
  heatmap: HeatmapDay[];
  atRisk: AtRiskStudent[];
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function scoreBucketColor(avg: number) {
  if (avg >= 90) return '#2E6B57';
  if (avg >= 80) return '#302BB8';
  if (avg >= 70) return '#E8B04B';
  if (avg >= 60) return '#C56A2B';
  return '#C4451F';
}

// Everything a teacher needs to see how their WHOLE class is doing, at a glance and in
// depth: a trend over time, a distribution of who's where, which kinds of activities the
// class handles well or struggles with, a ranked leaderboard, a day-by-day engagement
// heatmap, and a concrete list of who needs attention. Built from the exact same
// slide_submissions/mcq_task_submissions/grading_enabled data as the Gradebook and each
// student's own Grades tab, so nothing here can drift out of sync with what they see.
export function useClassReports(classId: string | null) {
  return useQuery({
    queryKey: ['class-reports', classId],
    enabled: Boolean(classId),
    queryFn: async (): Promise<ClassReportsData> => {
      const [rosterRes, resourcesRes] = await Promise.all([
        supabase
          .from('class_members')
          .select('student_id, profiles(full_name)')
          .eq('class_id', classId!),
        supabase
          .from('lesson_resources')
          .select('id, week_number, lesson_number, title')
          .eq('class_id', classId!),
      ]);
      if (rosterRes.error) throw rosterRes.error;
      if (resourcesRes.error) throw resourcesRes.error;

      const resources = resourcesRes.data ?? [];
      const resourceIds = resources.map((r) => r.id);
      const students = (rosterRes.data ?? []).map((r) => ({
        studentId: r.student_id,
        name: (r.profiles as { full_name: string } | null)?.full_name ?? 'Student',
      }));

      const [slidesRes, tasksRes] = await Promise.all([
        resourceIds.length > 0
          ? supabase
              .from('lesson_slides')
              .select('id, resource_id, activity_tag, objects')
              .in('resource_id', resourceIds)
              .eq('grading_enabled', true)
          : Promise.resolve({ data: [], error: null }),
        resourceIds.length > 0
          ? supabase
              .from('lesson_attached_tasks')
              .select('id, resource_id')
              .in('resource_id', resourceIds)
              .eq('kind', 'custom_mcqs')
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (slidesRes.error) throw slidesRes.error;
      if (tasksRes.error) throw tasksRes.error;

      const slides = slidesRes.data ?? [];
      const tasks = tasksRes.data ?? [];
      const slideIds = slides.map((s) => s.id);
      const taskIds = tasks.map((t) => t.id);
      const slideById = new Map(slides.map((s) => [s.id, s]));

      const [slideSubsRes, mcqSubsRes] = await Promise.all([
        slideIds.length > 0
          ? supabase
              .from('slide_submissions')
              .select('slide_id, student_id, grade, answers, submitted_at')
              .in('slide_id', slideIds)
              .not('submitted_at', 'is', null)
          : Promise.resolve({ data: [], error: null }),
        taskIds.length > 0
          ? supabase
              .from('mcq_task_submissions')
              .select('task_id, student_id, score, submitted_at')
              .in('task_id', taskIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (slideSubsRes.error) throw slideSubsRes.error;
      if (mcqSubsRes.error) throw mcqSubsRes.error;

      // Flatten every graded event into one common shape: who, what score, when, and (for
      // slides only) which activity tag it belongs to — quizzes get their own pseudo-tag.
      interface GradedEvent {
        studentId: string;
        percent: number;
        submittedAt: string;
        tagKey: string;
        tagLabel: string;
      }
      const events: GradedEvent[] = [];

      for (const sub of slideSubsRes.data ?? []) {
        const slide = slideById.get(sub.slide_id);
        if (!slide || !sub.submitted_at) continue;
        const hasManualGrade = sub.grade !== null && sub.grade !== undefined;
        const percent = hasManualGrade
          ? sub.grade!
          : (autoGradeSlide(
              (slide.objects ?? []) as unknown as SlideObject[],
              (sub.answers ?? {}) as unknown as SlideAnswers,
            )?.percent ?? null);
        if (percent === null) continue;
        events.push({
          studentId: sub.student_id,
          percent,
          submittedAt: sub.submitted_at,
          tagKey: slide.activity_tag ?? 'untagged',
          tagLabel: slide.activity_tag ? ACTIVITY_TAG_LABELS[slide.activity_tag] : 'Untagged',
        });
      }
      for (const sub of mcqSubsRes.data ?? []) {
        if (!sub.submitted_at) continue;
        events.push({
          studentId: sub.student_id,
          percent: sub.score,
          submittedAt: sub.submitted_at,
          tagKey: 'quiz',
          tagLabel: 'Quizzes',
        });
      }

      const totalGradableItems = slideIds.length + taskIds.length;

      // --- Per-student aggregates (leaderboard + at-risk + distribution) ---
      const eventsByStudent = new Map<string, GradedEvent[]>();
      for (const e of events) {
        const list = eventsByStudent.get(e.studentId) ?? [];
        list.push(e);
        eventsByStudent.set(e.studentId, list);
      }

      const leaderboard: LeaderboardEntry[] = students
        .map((s) => {
          const myEvents = eventsByStudent.get(s.studentId) ?? [];
          const avgScore =
            myEvents.length > 0
              ? Math.round(myEvents.reduce((sum, e) => sum + e.percent, 0) / myEvents.length)
              : null;
          return {
            studentId: s.studentId,
            name: s.name,
            avgScore,
            completed: myEvents.length,
            total: totalGradableItems,
          };
        })
        .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));

      // --- Distribution (bucket each student's average) ---
      const bucketDefs = [
        { label: '90-100', min: 90, color: '#2E6B57' },
        { label: '80-89', min: 80, color: '#302BB8' },
        { label: '70-79', min: 70, color: '#E8B04B' },
        { label: '60-69', min: 60, color: '#C56A2B' },
        { label: '<60', min: -Infinity, color: '#C4451F' },
      ];
      const distribution: DistributionBucket[] = bucketDefs.map((b) => ({
        label: b.label,
        color: b.color,
        count: leaderboard.filter(
          (l) =>
            l.avgScore !== null &&
            l.avgScore >= b.min &&
            l.avgScore < (bucketDefs[bucketDefs.indexOf(b) - 1]?.min ?? Infinity),
        ).length,
      }));

      // --- Radar (average score per activity tag, including the "Quizzes" pseudo-tag) ---
      const byTag = new Map<string, { label: string; sum: number; count: number }>();
      for (const e of events) {
        const entry = byTag.get(e.tagKey) ?? { label: e.tagLabel, sum: 0, count: 0 };
        entry.sum += e.percent;
        entry.count += 1;
        byTag.set(e.tagKey, entry);
      }
      const radar: RadarAxis[] = Array.from(byTag.entries()).map(([key, v]) => ({
        key,
        label: v.label,
        avgScore: v.count > 0 ? Math.round(v.sum / v.count) : null,
      }));

      // --- Weekly trend (rolling 8-week average score, most recent last) ---
      const now = Date.now();
      const trendBuckets = Array.from({ length: TREND_WEEKS }, (_, i) => ({
        label: i === TREND_WEEKS - 1 ? 'This wk' : `${TREND_WEEKS - 1 - i}wk ago`,
        sum: 0,
        count: 0,
      }));
      for (const e of events) {
        const daysAgo = Math.floor((now - new Date(e.submittedAt).getTime()) / 86_400_000);
        const weekIndex = Math.floor(daysAgo / 7);
        if (weekIndex >= 0 && weekIndex < TREND_WEEKS) {
          const bucket = trendBuckets[TREND_WEEKS - 1 - weekIndex];
          bucket.sum += e.percent;
          bucket.count += 1;
        }
      }
      const trend: TrendPoint[] = trendBuckets.map((b) => ({
        label: b.label,
        count: b.count,
        avgScore: b.count > 0 ? Math.round(b.sum / b.count) : null,
      }));

      // --- Engagement heatmap (submissions per day, last HEATMAP_DAYS days) ---
      const countByDay = new Map<string, number>();
      for (const e of events) {
        const key = dayKey(e.submittedAt);
        countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
      }
      const heatmap: HeatmapDay[] = Array.from({ length: HEATMAP_DAYS }, (_, i) => {
        const d = new Date(now - (HEATMAP_DAYS - 1 - i) * 86_400_000);
        const key = d.toISOString().slice(0, 10);
        return { date: key, count: countByDay.get(key) ?? 0 };
      });

      // --- At-risk students ---
      const lastActiveByStudent = new Map<string, number>();
      for (const e of events) {
        const t = new Date(e.submittedAt).getTime();
        const prev = lastActiveByStudent.get(e.studentId) ?? 0;
        if (t > prev) lastActiveByStudent.set(e.studentId, t);
      }
      const atRisk: AtRiskStudent[] = leaderboard
        .map((l) => {
          const lastActive = lastActiveByStudent.get(l.studentId);
          const daysSinceActive = lastActive ? Math.floor((now - lastActive) / 86_400_000) : null;
          const reasons: string[] = [];
          if (l.avgScore !== null && l.avgScore < AT_RISK_SCORE_THRESHOLD) {
            reasons.push(`Averaging ${l.avgScore}%`);
          }
          if (l.completed === 0) {
            reasons.push('No work submitted yet');
          } else if (daysSinceActive !== null && daysSinceActive > AT_RISK_INACTIVITY_DAYS) {
            reasons.push(`Inactive ${daysSinceActive}d`);
          }
          return { ...l, daysSinceActive, reasons };
        })
        .filter((s) => s.reasons.length > 0)
        .sort((a, b) => (a.avgScore ?? -1) - (b.avgScore ?? -1));

      // --- KPIs ---
      const classAverage =
        leaderboard.filter((l) => l.avgScore !== null).length > 0
          ? Math.round(
              leaderboard
                .filter((l) => l.avgScore !== null)
                .reduce((sum, l) => sum + l.avgScore!, 0) /
                leaderboard.filter((l) => l.avgScore !== null).length,
            )
          : null;
      const possibleSubmissions = students.length * totalGradableItems;
      const completionRate =
        possibleSubmissions > 0 ? Math.round((events.length / possibleSubmissions) * 100) : 0;

      const kpis: ReportKpis = {
        classAverage,
        completionRate,
        totalSubmissions: events.length,
        atRiskCount: atRisk.length,
        studentCount: students.length,
      };

      return { kpis, trend, distribution, radar, leaderboard, heatmap, atRisk };
    },
  });
}

export { scoreBucketColor };
