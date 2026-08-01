import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

export function useClassRoster(classId: string) {
  const query = useQuery({
    queryKey: ['class-roster', classId],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('class_members')
        .select('profiles(*)')
        .eq('class_id', classId);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.profiles as Profile);
    },
  });

  return { ...query, students: query.data ?? [] };
}
