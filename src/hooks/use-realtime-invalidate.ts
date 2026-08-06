import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// Subscribes to Postgres Changes on `table` (scoped by `filter`, e.g. "resource_id=eq.<uuid>")
// and invalidates `queryKey` on any insert/update/delete — a thin, reusable bridge from
// Supabase Realtime to TanStack Query for data that multiple viewers (a teacher plus several
// students) need to see change live without a manual refresh, e.g. a slide's `timer_command`
// or a submission's `grade`. `queryKey` is read from a ref (kept current every render, same
// reasoning as the payloadRef pattern in use-live-class-session.ts) so passing a fresh array
// literal each render doesn't force a resubscribe — only `table`/`filter`/`enabled` do that.
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
    if (!enabled || !filter) return;
    const channel = supabase
      .channel(`realtime:${table}:${filter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeyRef.current });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, enabled, queryClient]);
}
