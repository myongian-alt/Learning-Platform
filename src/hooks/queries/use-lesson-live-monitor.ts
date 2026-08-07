import { useQuery } from '@tanstack/react-query';

import { useRealtimeInvalidate } from '@/hooks/use-realtime-invalidate';
import { supabase } from '@/lib/supabase';
import type { LessonLivePresence, SlidePacingMode, SlideSubmission } from '@/types/database';

import type { SlideObject, SlideStroke, ViewableSlide } from './use-lesson-slides';
import { useLessonSlides } from './use-lesson-slides';
import type { StudentLivePresencePayload } from './use-live-class-session';
import { useLiveClassSessions, useStudentLiveClassPresence } from './use-live-class-session';

interface MonitorStudentProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface MonitorRosterRow {
  student_id: string;
  profiles: MonitorStudentProfile | null;
}

export type ActivitySignal = 'green' | 'brown' | 'red';

export interface LessonMonitorStudent {
  id: string;
  slide_id: string;
  student_id: string;
  submitted_at: string | null;
  updated_at: string;
  grade: number | null;
  feedback: string | null;
  answers: SlideSubmission['answers'];
  studentId: string;
  fullName: string;
  avatarUrl: string | null;
  signal: ActivitySignal;
  isOnlineNow: boolean;
  resourceId: string | null;
  slideId: string | null;
  slideIndex: number | null;
  pacingMode: SlidePacingMode | null;
  followingTeacher: boolean;
  submissionsEnabled: boolean;
  submittedCurrentSlide: boolean;
  lastActiveAt: string | null;
  lastEventType: string | null;
  inactivityMs: number | null;
  isOnTeacherSlide: boolean | null;
  annotations: SlideStroke[];
  objects: SlideObject[];
  teacher_annotations: SlideStroke[];
  teacher_comment: string | null;
}

// The ephemeral realtime payload (camelCase) and the persisted DB row (snake_case)
// carry the same information under different shapes — normalize to one before use so
// the rest of this file has a single discriminant point instead of re-deriving
// `live?.resourceId === resourceId` per field (which `tsc` can't correlate across
// separate expressions, even though the branches are runtime-consistent).
interface EffectivePresence {
  lastActiveAt: string | null;
  slideId: string | null;
  slideIndex: number | null;
  pacingMode: SlidePacingMode | null;
  followingTeacher: boolean;
  submissionsEnabled: boolean;
  lastEventType: string | null;
}

function normalizePresence(
  live: StudentLivePresencePayload | undefined,
  persisted: LessonLivePresence | undefined,
  resourceId: string | null,
): EffectivePresence | null {
  if (live?.resourceId === resourceId) {
    return {
      lastActiveAt: live.lastActiveAt,
      slideId: live.slideId,
      slideIndex: live.slideIndex,
      pacingMode: live.pacingMode,
      followingTeacher: live.followingTeacher,
      submissionsEnabled: live.submissionsEnabled,
      lastEventType: live.lastEventType,
    };
  }
  if (persisted?.resource_id === resourceId) {
    return {
      lastActiveAt: persisted.last_seen_at,
      slideId: persisted.slide_id,
      slideIndex: persisted.slide_index,
      pacingMode: persisted.pacing_mode,
      followingTeacher: persisted.following_teacher,
      submissionsEnabled: persisted.submissions_enabled,
      lastEventType: persisted.last_event_type,
    };
  }
  return null;
}

function computeSignal(lastActiveAt: string | null, isOnlineNow: boolean): {
  signal: ActivitySignal;
  inactivityMs: number | null;
} {
  if (!lastActiveAt) return { signal: 'red', inactivityMs: null };
  const inactivityMs = Date.now() - new Date(lastActiveAt).getTime();
  if (inactivityMs < 60_000 && isOnlineNow) return { signal: 'green', inactivityMs };
  if (inactivityMs <= 180_000) return { signal: 'brown', inactivityMs };
  return { signal: 'red', inactivityMs };
}

export function useLessonLiveMonitor(classId: string | null, resourceId: string | null) {
  const teacherLive = useLiveClassSessions(classId ? [classId] : []);
  const liveStudents = useStudentLiveClassPresence(classId);
  const slidesQuery = useLessonSlides(resourceId);

  const rosterQuery = useQuery({
    queryKey: ['lesson-monitor-roster', classId],
    enabled: Boolean(classId),
    queryFn: async (): Promise<MonitorRosterRow[]> => {
      const { data, error } = await supabase
        .from('class_members')
        .select('student_id, profiles:student_id(id, full_name, avatar_url)')
        .eq('class_id', classId!);
      if (error) throw error;
      return (data ?? []) as unknown as MonitorRosterRow[];
    },
  });

  const persistedQuery = useQuery({
    queryKey: ['lesson-monitor-presence', classId, resourceId],
    enabled: Boolean(classId) && Boolean(resourceId),
    queryFn: async (): Promise<LessonLivePresence[]> => {
      const { data, error } = await supabase
        .from('lesson_live_presence')
        .select('*')
        .eq('class_id', classId!)
        .eq('resource_id', resourceId!)
        .order('last_seen_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const slideIds = (slidesQuery.data ?? []).map((slide) => slide.id);
  const submissionsQuery = useQuery({
    queryKey: ['lesson-monitor-resource-submissions', resourceId, slideIds.join(',')],
    enabled: Boolean(resourceId) && slideIds.length > 0,
    queryFn: async (): Promise<SlideSubmission[]> => {
      const { data, error } = await supabase
        .from('slide_submissions')
        .select('*')
        .in('slide_id', slideIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Both use the shared ref-counted channel registry (see use-realtime-invalidate.ts) rather
  // than hand-rolled channels — this monitor hook is mounted from class-progress, which a
  // teacher can reach while the Lessons page (with its own realtime-backed hooks for the same
  // class/resource) is still mounted underneath it (expo-router keeps prior screens mounted),
  // so a hand-rolled channel here would hit the exact same "two subscribers, one topic" crash
  // already fixed for lesson_slides/slide_submissions grade-sync elsewhere.
  useRealtimeInvalidate(
    'lesson_live_presence',
    classId ? `class_id=eq.${classId}` : null,
    ['lesson-monitor-presence', classId, resourceId],
    Boolean(classId) && Boolean(resourceId),
  );
  // Table-wide on purpose (no per-slide filter) — a teacher's monitor needs to react to any
  // student's submission changing, and slide_submissions has no resource_id column to filter
  // on directly without an `in.(...)` list of this resource's slide ids.
  useRealtimeInvalidate(
    'slide_submissions',
    null,
    ['lesson-monitor-resource-submissions', resourceId],
    Boolean(resourceId),
  );

  const slidesById = new Map((slidesQuery.data ?? []).map((slide) => [slide.id, slide]));
  const persistedByStudent = new Map((persistedQuery.data ?? []).map((row) => [row.student_id, row]));
  const submissionByStudentAndSlide = new Map(
    (submissionsQuery.data ?? []).map((row) => [`${row.student_id}:${row.slide_id}`, row]),
  );

  const students: LessonMonitorStudent[] = (rosterQuery.data ?? [])
    .map((row) => {
      const profile = row.profiles;
      const live = liveStudents[row.student_id];
      const persisted = persistedByStudent.get(row.student_id);
      const effectivePresence = normalizePresence(live, persisted, resourceId);
      const lastActiveAt = effectivePresence?.lastActiveAt ?? null;
      const isOnlineNow = Boolean(live && live.resourceId === resourceId);
      const { signal, inactivityMs } = computeSignal(lastActiveAt, isOnlineNow);
      const slideId = effectivePresence?.slideId ?? null;
      const slideIndex = effectivePresence?.slideIndex ?? null;
      const submission = slideId
        ? submissionByStudentAndSlide.get(`${row.student_id}:${slideId}`)
        : null;

      return {
        id: submission?.id ?? `${row.student_id}-${slideId ?? 'none'}`,
        slide_id: slideId ?? '',
        student_id: row.student_id,
        submitted_at: submission?.submitted_at ?? null,
        updated_at: submission?.updated_at ?? lastActiveAt ?? new Date(0).toISOString(),
        grade: submission?.grade ?? null,
        feedback: submission?.feedback ?? null,
        answers: submission?.answers ?? {},
        studentId: row.student_id,
        fullName: profile?.full_name ?? 'Student',
        avatarUrl: profile?.avatar_url ?? null,
        signal,
        isOnlineNow,
        resourceId,
        slideId,
        slideIndex,
        pacingMode: effectivePresence?.pacingMode ?? null,
        followingTeacher: effectivePresence?.followingTeacher ?? false,
        submissionsEnabled: effectivePresence?.submissionsEnabled ?? false,
        submittedCurrentSlide: Boolean(submission?.submitted_at),
        lastActiveAt,
        lastEventType: effectivePresence?.lastEventType ?? null,
        inactivityMs,
        isOnTeacherSlide:
          teacherLive?.resourceId === resourceId && teacherLive.slideId && slideId
            ? teacherLive.slideId === slideId
            : null,
        annotations: (submission?.annotations as unknown as SlideStroke[]) ?? [],
        objects: (submission?.objects as unknown as SlideObject[]) ?? [],
        teacher_annotations: (submission?.teacher_annotations as unknown as SlideStroke[]) ?? [],
        teacher_comment: submission?.teacher_comment ?? null,
      };
    })
    .filter((student) => student.slideId || student.lastActiveAt);

  return {
    students,
    liveSession: teacherLive?.resourceId === resourceId ? teacherLive : null,
    slides: slidesQuery.data ?? [],
    slidesById: slidesById as Map<string, ViewableSlide>,
    isLoading:
      rosterQuery.isLoading ||
      persistedQuery.isLoading ||
      slidesQuery.isLoading ||
      submissionsQuery.isLoading,
    error:
      rosterQuery.error ??
      persistedQuery.error ??
      slidesQuery.error ??
      submissionsQuery.error,
  };
}
