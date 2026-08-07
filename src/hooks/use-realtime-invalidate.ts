import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// Module-level, ref-counted registry — the same shared-channel pattern already established in
// use-live-class-session.ts, for the same reason: expo-router keeps prior screens mounted
// (e.g. the Lessons page's own useLessonSlides(resourceId) stays alive underneath the
// class-progress monitor screen pushed on top of it for the SAME resourceId), so more than one
// `useRealtimeInvalidate` consumer can end up wanting the same `table:filter` topic at once.
// Supabase's realtime client throws ("cannot add postgres_changes callbacks... after
// subscribe()") if a second channel object subscribes to the same topic — this crashed the app
// outright the first time two screens both watched `lesson_slides:resource_id=eq.<id>`
// simultaneously. Sharing one real channel per topic, fanned out to every listener, avoids that.
interface SharedRealtimeChannel {
  channel: ReturnType<typeof supabase.channel>;
  refCount: number;
  listeners: Set<() => void>;
}
const sharedRealtimeChannels = new Map<string, SharedRealtimeChannel>();

function acquireRealtimeChannel(
  key: string,
  table: string,
  filter: string | null,
  onEvent: () => void,
) {
  let entry = sharedRealtimeChannels.get(key);
  if (!entry) {
    const channel = supabase.channel(`realtime:${key}`);
    const created: SharedRealtimeChannel = { channel, refCount: 0, listeners: new Set() };
    // `filter` omitted entirely (not just falsy) subscribes table-wide — Supabase treats a
    // present-but-empty filter differently, so this can't just be `filter: filter ?? undefined`
    // folded into one object literal.
    const config = filter
      ? { event: '*' as const, schema: 'public', table, filter }
      : { event: '*' as const, schema: 'public', table };
    channel.on('postgres_changes', config, () => {
      created.listeners.forEach((fn) => fn());
    });
    channel.subscribe();
    sharedRealtimeChannels.set(key, created);
    entry = created;
  }
  entry.refCount += 1;
  entry.listeners.add(onEvent);
}

function releaseRealtimeChannel(key: string, onEvent: () => void) {
  const entry = sharedRealtimeChannels.get(key);
  if (!entry) return;
  entry.listeners.delete(onEvent);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    sharedRealtimeChannels.delete(key);
  }
}

// Subscribes to Postgres Changes on `table` (scoped by `filter`, e.g. "resource_id=eq.<uuid>",
// or `null` for every row in the table) and invalidates `queryKey` on any insert/update/delete
// — a thin, reusable bridge from Supabase Realtime to TanStack Query for data that multiple
// viewers (a teacher plus several students, or a teacher's own two screens at once) need to see
// change live without a manual refresh, e.g. a slide's `timer_command`, a submission's `grade`,
// or every submission for a lesson a teacher is monitoring. `enabled` is the sole "should this
// subscribe at all" switch — every existing caller already only passes `filter: null` together
// with `enabled: false`, so a `null` filter while enabled is unambiguously "no filter," not
// "don't subscribe." `queryKey` is read from a ref (kept current every render, same reasoning
// as the payloadRef pattern in use-live-class-session.ts) so passing a fresh array literal each
// render doesn't force a resubscribe — only `table`/`filter`/`enabled` do that.
export function useRealtimeInvalidate(
  table: string,
  filter: string | null,
  queryKey: QueryKey,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const queryKeyRef = useRef(queryKey);
  useEffect(() => {
    queryKeyRef.current = queryKey;
  }, [queryKey]);

  useEffect(() => {
    if (!enabled) return;
    const key = `${table}:${filter ?? '*'}`;
    const onEvent = () => queryClient.invalidateQueries({ queryKey: queryKeyRef.current });
    acquireRealtimeChannel(key, table, filter, onEvent);
    return () => releaseRealtimeChannel(key, onEvent);
  }, [table, filter, enabled, queryClient]);
}
