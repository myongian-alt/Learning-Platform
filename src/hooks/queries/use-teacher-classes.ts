import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { generateJoinCode } from '@/lib/codes';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { ClassRow } from '@/types/database';

export type ClassWithMemberCount = ClassRow & { class_members: { count: number }[] };

export function useTeacherClasses() {
  const teacherId = useAuthStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  const classesQuery = useQuery({
    queryKey: ['teacher-classes', teacherId],
    enabled: Boolean(teacherId),
    queryFn: async (): Promise<ClassWithMemberCount[]> => {
      const { data, error } = await supabase
        .from('classes')
        .select('*, class_members(count)')
        .eq('teacher_id', teacherId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClassWithMemberCount[];
    },
  });

  const createClass = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('classes')
        .insert({ name, teacher_id: teacherId!, join_code: generateJoinCode() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-classes', teacherId] });
    },
  });

  return { classesQuery, createClass };
}
