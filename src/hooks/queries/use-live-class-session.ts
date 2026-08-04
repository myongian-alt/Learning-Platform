import { AppState } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { SlidePacingMode } from '@/types/database';

// Ephemeral Realtime Presence, no persisted state — mirrors the existing
// assignment-pipeline pattern in use-canvas-presence.ts/use-live-monitor.ts, just for
// "is a teacher currently presenting a lesson slide in this class."
export interface LiveSlidePayload {
  resourceId: string;
  resourceTitle: string;
  slideId: string;
  slideIndex: number;
  totalSlides: number;
  submissionsEnabled: boolean;
}

export interface StudentLivePresencePayload {
  classId: string;
  studentId: string;
  resourceId: string;
  slideId: string | null;
  slideIndex: number | null;
  pacingMode: SlidePacingMode | null;
  followingTeacher: boolean;
  submissionsEnabled: boolean;
  lastActiveAt: string;
  lastEventType: string;
}

interface StudentPresenceOptions {
  viewerRole: 'teacher' | 'student';
  classId: string | null;
  resourceId: string | null;
  slideId: string | null;
  slideIndex: number | null;
  pacingMode: SlidePacingMode | null;
  followingTeacher: boolean;
  submissionsEnabled: boolean;
  studentId: string | null;
}

// Teacher side: tracks presence on `class-live:{classId}` while a slide viewer is open
// with `payload` set; untracks when `payload` becomes null (submissions/timer state
// changes flow through by just passing a new payload — no resubscribe needed).
export function useTeacherLivePresence(classId: string | null, payload: LiveSlidePayload | null) {
  const teacherId = useAuthStore((s) => s.session?.user.id);
  const payloadRef = useRef(payload);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    if (!classId || !teacherId) return;
    const channel = supabase.channel(`class-live:${classId}`, {
      config: { presence: { key: teacherId } },
    });
    channelRef.current = channel;
    subscribedRef.current = false;

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        subscribedRef.current = true;
        if (payloadRef.current) channel.track(payloadRef.current);
      }
    });

    return () => {
      subscribedRef.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [classId, teacherId]);

  // Guarded on `subscribedRef`: calling `.track()` before the channel has actually
  // reached SUBSCRIBED silently does nothing (same reasoning as the established
  // use-canvas-presence.ts pattern of only tracking inside the SUBSCRIBED callback).
  // The very first track happens via that callback above, using `payloadRef` (kept
  // current by the effect above it) — this effect only needs to handle subsequent
  // payload changes, like the teacher navigating to a different slide.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;
    if (payload) void channel.track(payload);
    else void channel.untrack();
  }, [payload]);
}

// Module-level, ref-counted registry: React Navigation keeps prior screens mounted
// (e.g. Home stays alive underneath a pushed /class/[id] route, which itself stays
// alive underneath the slide viewer it renders in place of its own tree), so more than
// one `useLiveClassSessions` consumer can be watching the same classId at once.
// Supabase's realtime client throws ("cannot add `presence` callbacks... after
// `subscribe()`") if a second channel object for the same topic tries to register its
// own listener — sharing one real channel per classId, fanned out to every listener,
// avoids that entirely.
interface SharedLiveChannel {
  channel: ReturnType<typeof supabase.channel>;
  refCount: number;
  listeners: Set<() => void>;
}
const sharedLiveChannels = new Map<string, SharedLiveChannel>();

interface SharedStudentChannel {
  channel: ReturnType<typeof supabase.channel>;
  refCount: number;
  listeners: Set<() => void>;
}
const sharedStudentChannels = new Map<string, SharedStudentChannel>();

function acquireLiveChannel(classId: string, onSync: () => void) {
  let entry = sharedLiveChannels.get(classId);
  if (!entry) {
    const channel = supabase.channel(`class-live:${classId}`);
    const created: SharedLiveChannel = { channel, refCount: 0, listeners: new Set() };
    channel.on('presence', { event: 'sync' }, () => {
      created.listeners.forEach((fn) => fn());
    });
    channel.subscribe();
    sharedLiveChannels.set(classId, created);
    entry = created;
  }
  entry.refCount += 1;
  entry.listeners.add(onSync);
}

function releaseLiveChannel(classId: string, onSync: () => void) {
  const entry = sharedLiveChannels.get(classId);
  if (!entry) return;
  entry.listeners.delete(onSync);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    sharedLiveChannels.delete(classId);
  }
}

function acquireStudentChannel(classId: string, onSync: () => void) {
  let entry = sharedStudentChannels.get(classId);
  if (!entry) {
    const channel = supabase.channel(`class-students:${classId}`);
    const created: SharedStudentChannel = { channel, refCount: 0, listeners: new Set() };
    channel.on('presence', { event: 'sync' }, () => {
      created.listeners.forEach((fn) => fn());
    });
    channel.subscribe();
    sharedStudentChannels.set(classId, created);
    entry = created;
  }
  entry.refCount += 1;
  entry.listeners.add(onSync);
}

function releaseStudentChannel(classId: string, onSync: () => void) {
  const entry = sharedStudentChannels.get(classId);
  if (!entry) return;
  entry.listeners.delete(onSync);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    sharedStudentChannels.delete(classId);
  }
}

// Student side: watches one or more classes' live channels and returns the first live
// slide session found (a student is realistically only ever in one live session at a
// time). Pass a single-element array from inside the lesson viewer's "Follow teacher"
// mode, or the student's full class list from the Home dashboard.
export function useLiveClassSessions(classIds: string[]) {
  const [liveByClass, setLiveByClass] = useState<Record<string, LiveSlidePayload>>({});
  const key = classIds.slice().sort().join(',');

  useEffect(() => {
    if (classIds.length === 0) return;

    const subscriptions = classIds.map((classId) => {
      const sync = () => {
        const entry = sharedLiveChannels.get(classId);
        const state = entry?.channel.presenceState<LiveSlidePayload>() ?? {};
        const first = Object.values(state).flat()[0] ?? null;
        setLiveByClass((prev) => {
          const next = { ...prev };
          if (first) next[classId] = first;
          else delete next[classId];
          return next;
        });
      };
      acquireLiveChannel(classId, sync);
      return { classId, sync };
    });

    return () => {
      subscriptions.forEach(({ classId, sync }) => releaseLiveChannel(classId, sync));
    };
    // `classIds` is reduced to a stable, order-independent `key` above — re-running this
    // effect per array-identity-change would tear down/recreate channels every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Gating on `classIds.length` (rather than resetting `liveByClass` in the effect above)
  // means a class list that's temporarily empty never reads a stale entry from before —
  // and once it's non-empty again, `key` changing re-subscribes and repopulates normally.
  if (classIds.length === 0) return null;
  const entry = Object.entries(liveByClass).find(([classId]) => classIds.includes(classId));
  return entry ? { classId: entry[0], ...entry[1] } : null;
}

export function useStudentLiveClassPresence(classId: string | null) {
  const [presenceByStudent, setPresenceByStudent] = useState<Record<string, StudentLivePresencePayload>>({});

  useEffect(() => {
    if (!classId) return;

    const sync = () => {
      const entry = sharedStudentChannels.get(classId);
      const state = entry?.channel.presenceState<StudentLivePresencePayload>() ?? {};
      const next: Record<string, StudentLivePresencePayload> = {};
      Object.values(state)
        .flat()
        .forEach((payload) => {
          if (payload?.studentId) next[payload.studentId] = payload;
        });
      setPresenceByStudent(next);
    };

    acquireStudentChannel(classId, sync);

    return () => {
      releaseStudentChannel(classId, sync);
    };
  }, [classId]);

  return presenceByStudent;
}

export function useStudentLessonPresence({
  viewerRole,
  classId,
  resourceId,
  slideId,
  slideIndex,
  pacingMode,
  followingTeacher,
  submissionsEnabled,
  studentId,
}: StudentPresenceOptions) {
  const active =
    viewerRole === 'student' && Boolean(classId) && Boolean(resourceId) && Boolean(studentId);
  const payloadRef = useRef<StudentLivePresencePayload | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const lastPersistedAtRef = useRef(0);

  const persistSnapshot = useCallback(async (
    payload: StudentLivePresencePayload,
    options?: { force?: boolean; isPresent?: boolean; leftAt?: string | null },
  ) => {
    const now = Date.now();
    if (!options?.force && now - lastPersistedAtRef.current < 45_000) return;
    lastPersistedAtRef.current = now;
    const timestamp = options?.leftAt ?? payload.lastActiveAt;
    await supabase.from('lesson_live_presence').upsert(
      {
        class_id: payload.classId,
        student_id: payload.studentId,
        resource_id: payload.resourceId,
        slide_id: payload.slideId,
        slide_index: payload.slideIndex,
        pacing_mode: payload.pacingMode,
        is_present: options?.isPresent ?? true,
        following_teacher: payload.followingTeacher,
        submissions_enabled: payload.submissionsEnabled,
        last_event_type: payload.lastEventType,
        last_seen_at: payload.lastActiveAt,
        left_at: options?.leftAt ?? null,
        updated_at: timestamp,
      },
      { onConflict: 'class_id,student_id' },
    );
  }, []);

  const buildPayload = useCallback((eventType: string): StudentLivePresencePayload | null => {
    if (!active || !classId || !resourceId || !studentId) return null;
    return {
      classId,
      studentId,
      resourceId,
      slideId,
      slideIndex,
      pacingMode,
      followingTeacher,
      submissionsEnabled,
      lastActiveAt: new Date().toISOString(),
      lastEventType: eventType,
    };
  }, [
    active,
    classId,
    followingTeacher,
    pacingMode,
    resourceId,
    slideId,
    slideIndex,
    studentId,
    submissionsEnabled,
  ]);

  const trackPresence = useCallback(async (eventType: string, forcePersist = false) => {
    const payload = buildPayload(eventType);
    if (!payload) return;
    payloadRef.current = payload;
    if (channelRef.current && subscribedRef.current) await channelRef.current.track(payload);
    void persistSnapshot(payload, { force: forcePersist });
  }, [buildPayload, persistSnapshot]);

  useEffect(() => {
    if (!active || !classId || !studentId) return;
    const channel = supabase.channel(`class-students:${classId}`, {
      config: { presence: { key: studentId } },
    });
    channelRef.current = channel;
    subscribedRef.current = false;

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        subscribedRef.current = true;
        void trackPresence('joined', true);
      }
    });

    return () => {
      const latest = payloadRef.current;
      if (latest) {
        const leftAt = new Date().toISOString();
        void supabase.from('lesson_live_presence').upsert(
          {
            class_id: latest.classId,
            student_id: latest.studentId,
            resource_id: latest.resourceId,
            slide_id: latest.slideId,
            slide_index: latest.slideIndex,
            pacing_mode: latest.pacingMode,
            is_present: false,
            following_teacher: latest.followingTeacher,
            submissions_enabled: latest.submissionsEnabled,
            last_event_type: 'left',
            last_seen_at: latest.lastActiveAt,
            left_at: leftAt,
            updated_at: leftAt,
          },
          { onConflict: 'class_id,student_id' },
        );
      }
      subscribedRef.current = false;
      void channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [active, classId, studentId, trackPresence]);

  useEffect(() => {
    if (!active) return;
    void trackPresence('navigated', true);
  }, [active, classId, resourceId, slideId, slideIndex, pacingMode, followingTeacher, submissionsEnabled, trackPresence]);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      void trackPresence('heartbeat');
    }, 20_000);
    return () => clearInterval(interval);
  }, [active, classId, resourceId, slideId, slideIndex, pacingMode, followingTeacher, submissionsEnabled, trackPresence]);

  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void trackPresence('resumed', true);
        return;
      }
      if (state !== 'background' && state !== 'inactive') return;
      const payload = buildPayload('backgrounded');
      if (!payload) return;
      payloadRef.current = payload;
      const leftAt = new Date().toISOString();
      void supabase.from('lesson_live_presence').upsert(
        {
          class_id: payload.classId,
          student_id: payload.studentId,
          resource_id: payload.resourceId,
          slide_id: payload.slideId,
          slide_index: payload.slideIndex,
          pacing_mode: payload.pacingMode,
          is_present: false,
          following_teacher: payload.followingTeacher,
          submissions_enabled: payload.submissionsEnabled,
          last_event_type: payload.lastEventType,
          last_seen_at: payload.lastActiveAt,
          left_at: leftAt,
          updated_at: leftAt,
        },
        { onConflict: 'class_id,student_id' },
      );
    });
    return () => sub.remove();
  }, [active, buildPayload, trackPresence]);

  return {
    markActivity: (eventType: string) => {
      if (!active) return;
      void trackPresence(eventType, true);
    },
  };
}
