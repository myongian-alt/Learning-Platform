import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { ClassRow } from '@/types/database';

export function useClassDetail(classId: string | null) {
  return useQuery({
    queryKey: ['class-detail', classId],
    enabled: Boolean(classId),
    queryFn: async (): Promise<ClassRow> => {
      const { data, error } = await supabase.from('classes').select('*').eq('id', classId!).single();
      if (error) throw error;
      return data;
    },
  });
}
