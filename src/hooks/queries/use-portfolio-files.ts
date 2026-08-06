import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { PortfolioFile } from '@/types/database';

// Files inside one Portfolio folder. RLS does the visibility split for us: a teacher's client
// gets every student's files in the folder (portfolio_files_teacher_select), a student's client
// only ever gets rows where student_id = auth.uid() (portfolio_files_student_select) — so this
// hook doesn't need a role branch, the same query just returns different rows per caller.
// Storage path convention: `{classId}/{folderId}/{studentId}/{filename}`, matching the
// path-segment RLS policies on the portfolio-files bucket.
export function usePortfolioFiles(classId: string | null, folderId: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['portfolio-files', folderId] });

  const query = useQuery({
    queryKey: ['portfolio-files', folderId],
    enabled: Boolean(folderId),
    queryFn: async (): Promise<PortfolioFile[]> => {
      const { data, error } = await supabase
        .from('portfolio_files')
        .select('*')
        .eq('folder_id', folderId!)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const uploadFile = useMutation({
    mutationFn: async (input: {
      studentId: string;
      uri: string;
      filename: string;
      mimeType: string | null;
      size: number | null;
    }) => {
      if (!classId || !folderId) throw new Error('No folder selected.');

      const response = await fetch(input.uri);
      const blob = await response.blob();
      const path = `${classId}/${folderId}/${input.studentId}/${Date.now()}-${input.filename}`;

      const { error: uploadError } = await supabase.storage
        .from('portfolio-files')
        .upload(path, blob, {
          contentType: input.mimeType ?? 'application/octet-stream',
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { error } = await supabase.from('portfolio_files').insert({
        folder_id: folderId,
        student_id: input.studentId,
        file_name: input.filename,
        storage_path: path,
        mime_type: input.mimeType,
        size_bytes: input.size,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteFile = useMutation({
    mutationFn: async (file: PortfolioFile) => {
      const { error } = await supabase.from('portfolio_files').delete().eq('id', file.id);
      if (error) throw error;
      await supabase.storage.from('portfolio-files').remove([file.storage_path]);
    },
    onSuccess: invalidate,
  });

  const getDownloadUrl = async (file: PortfolioFile) => {
    const { data, error } = await supabase.storage
      .from('portfolio-files')
      .createSignedUrl(file.storage_path, 3600);
    if (error) throw error;
    return data.signedUrl;
  };

  return { ...query, files: query.data ?? [], uploadFile, deleteFile, getDownloadUrl };
}
