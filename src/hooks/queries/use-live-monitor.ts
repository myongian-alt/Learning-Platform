import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { HelpRequest, Profile } from '@/types/database';

export interface RosterEntry {
  student: Profile;
  isOnline: boolean;
  hasOpenHelpRequest: boolean;
}

export function useLiveMonitor(assignmentId: string) {
  const [onlineStudentIds, setOnlineStudentIds] = useState<Set<string>>(new Set());
  const [openHelpRequestStudentIds, setOpenHelpRequestStudentIds] = useState<Set<string>>(
    new Set(),
  );

  const rosterQuery = useQuery({
    queryKey: ['live-roster', assignmentId],
    queryFn: async () => {
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('class_id')
        .eq('id', assignmentId)
        .single();
      if (assignmentError) throw assignmentError;

      const { data, error } = await supabase
        .from('class_members')
        .select('profiles(*)')
        .eq('class_id', assignment.class_id);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.profiles as Profile);
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`assignment:${assignmentId}`);

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ student_id: string }>();
      setOnlineStudentIds(
        new Set(
          Object.values(state)
            .flat()
            .map((p) => p.student_id),
        ),
      );
    });

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'help_requests',
        filter: `assignment_id=eq.${assignmentId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as HelpRequest;
        setOpenHelpRequestStudentIds((prev) => {
          const next = new Set(prev);
          if (row.status === 'open') next.add(row.student_id);
          else next.delete(row.student_id);
          return next;
        });
      },
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignmentId]);

  const roster: RosterEntry[] = (rosterQuery.data ?? []).map((student) => ({
    student,
    isOnline: onlineStudentIds.has(student.id),
    hasOpenHelpRequest: openHelpRequestStudentIds.has(student.id),
  }));

  return { roster, isLoading: rosterQuery.isLoading, error: rosterQuery.error };
}
