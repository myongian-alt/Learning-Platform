import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';

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
