import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';

/** Joins the assignment's realtime channel and broadcasts this student's presence, so the
 * teacher's live-monitoring screen (src/app/live/[assignmentId].tsx) can show them as online. */
export function useCanvasPresence(assignmentId: string) {
  const studentId = useAuthStore((s) => s.session?.user.id);
  const fullName = useAuthStore((s) => s.profile?.full_name);

  useEffect(() => {
    if (!studentId) return;

    const channel = supabase.channel(`assignment:${assignmentId}`, {
      config: { presence: { key: studentId } },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          student_id: studentId,
          full_name: fullName,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignmentId, studentId, fullName]);
}
