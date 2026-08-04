import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import type { LessonLivePresence, SlidePacingMode, SlideSubmission } from '@/types/database';

import type { SlideObject, SlideStroke, ViewableSlide } from './use-lesson-slides';
import { useLessonSlides } from './use-lesson-slides';
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
  const queryClient = useQueryClient();
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

  useEffect(() => {
    if (!classId || !resourceId) return;
    const channel = supabase.channel(`lesson-monitor-db:${classId}:${resourceId}`);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'lesson_live_presence',
        filter: `class_id=eq.${classId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ['lesson-monitor-presence', classId, resourceId] });
      },
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, queryClient, resourceId]);

  useEffect(() => {
    if (!resourceId) return;
    const channel = supabase.channel(`lesson-monitor-submissions:${resourceId}`);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'slide_submissions',
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ['lesson-monitor-resource-submissions', resourceId] });
      },
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, resourceId]);

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
      const effectivePresence =
        live?.resourceId === resourceId ? live : persisted?.resource_id === resourceId ? persisted : null;
      const lastActiveAt =
        live?.resourceId === resourceId ? live.lastActiveAt : effectivePresence?.last_seen_at ?? null;
      const isOnlineNow = Boolean(live && live.resourceId === resourceId);
      const { signal, inactivityMs } = computeSignal(lastActiveAt, isOnlineNow);
      const slideId =
        live?.resourceId === resourceId ? live.slideId : effectivePresence?.slide_id ?? null;
      const slideIndex =
        live?.resourceId === resourceId ? live.slideIndex : effectivePresence?.slide_index ?? null;
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
        pacingMode:
          live?.resourceId === resourceId ? live.pacingMode : effectivePresence?.pacing_mode ?? null,
        followingTeacher:
          live?.resourceId === resourceId ? live.followingTeacher : effectivePresence?.following_teacher ?? false,
        submissionsEnabled:
          live?.resourceId === resourceId ? live.submissionsEnabled : effectivePresence?.submissions_enabled ?? false,
        submittedCurrentSlide: Boolean(submission?.submitted_at),
        lastActiveAt,
        lastEventType:
          live?.resourceId === resourceId ? live.lastEventType : effectivePresence?.last_event_type ?? null,
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
