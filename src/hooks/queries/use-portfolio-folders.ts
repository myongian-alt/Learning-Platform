import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { PortfolioFolder } from '@/types/database';

// Teacher-authored folders like "Project" or "Copybook Work" that live under the class's
// Portfolio section. Students see the same folder list (read-only) via
// portfolio_folders_student_read RLS, but only teachers can create/rename/reorder/delete —
// enforced server-side by portfolio_folders_teacher_all, not just hidden client-side.
export function usePortfolioFolders(classId: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['portfolio-folders', classId] });

  const query = useQuery({
    queryKey: ['portfolio-folders', classId],
    enabled: Boolean(classId),
    queryFn: async (): Promise<PortfolioFolder[]> => {
      const { data, error } = await supabase
        .from('portfolio_folders')
        .select('*')
        .eq('class_id', classId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const folders = query.data ?? [];

  const createFolder = useMutation({
    mutationFn: async (input: { name: string; description: string | null }) => {
      if (!classId) throw new Error('No class selected.');
      const nextPosition = (folders[folders.length - 1]?.position ?? 0) + 1;
      const { error } = await supabase.from('portfolio_folders').insert({
        class_id: classId,
        name: input.name,
        description: input.description,
        position: nextPosition,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const renameFolder = useMutation({
    mutationFn: async (input: { id: string; name: string; description: string | null }) => {
      const { error } = await supabase
        .from('portfolio_folders')
        .update({
          name: input.name,
          description: input.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('portfolio_folders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, folders, createFolder, renameFolder, deleteFolder };
}
