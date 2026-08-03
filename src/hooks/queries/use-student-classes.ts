import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { ClassRow } from '@/types/database';

export function useStudentClasses() {
  const studentId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['student-classes', studentId],
    enabled: Boolean(studentId),
    queryFn: async (): Promise<ClassRow[]> => {
      const { data, error } = await supabase
        .from('class_members')
        .select('classes(*)')
        .eq('student_id', studentId!);
      if (error) throw error;
      return (data ?? [])
        .map((row) => row.classes)
        .filter((c): c is ClassRow => c !== null);
    },
  });
}
