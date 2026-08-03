import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { renderPdfToSlides, SLIDES_SUPPORTED } from '@/lib/pdf-to-slides';
import { supabase } from '@/lib/supabase';
import type { LessonFileType, LessonResource } from '@/types/database';

function inferFileType(mimeType: string | null | undefined): LessonFileType {
  const type = mimeType ?? '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type === 'application/pdf') return 'pdf';
  if (type.includes('presentation')) return 'pptx';
  return 'docx';
}

function titleFromFilename(filename: string) {
  return filename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
}

async function uploadImageBlob(path: string, blob: Blob, contentType: string) {
  const { error } = await supabase.storage
    .from('lesson-files')
    .upload(path, blob, { contentType, upsert: true });
  if (error) throw error;
}

/** Renders a PDF/image blob into `lesson_slides` rows and flips `conversion_status`
 * to 'ready' or 'failed'. Shared by the initial upload and by retrying a resource
 * that got stuck at 'pending' (e.g. the tab closed mid-conversion last time). */
async function convertToSlides(resource: {
  id: string;
  class_id: string;
  week_number: number;
  file_type: LessonFileType;
  storage_path: string | null;
}, blob: Blob) {
  try {
    if (resource.file_type === 'image') {
      if (!resource.storage_path) throw new Error('Missing storage path for image.');
      const { error: slideError } = await supabase
        .from('lesson_slides')
        .insert({ resource_id: resource.id, position: 1, storage_path: resource.storage_path });
      if (slideError) throw slideError;
    } else {
      const slides = await renderPdfToSlides(blob);
      for (const slide of slides) {
        const slidePath = `${resource.class_id}/${resource.week_number}/slides/${resource.id}/${slide.position}.png`;
        await uploadImageBlob(slidePath, slide.blob, 'image/png');
        const { error: slideError } = await supabase
          .from('lesson_slides')
          .insert({ resource_id: resource.id, position: slide.position, storage_path: slidePath });
        if (slideError) throw slideError;
      }
    }
    await supabase.from('lesson_resources').update({ conversion_status: 'ready' }).eq('id', resource.id);
  } catch (conversionError) {
    console.warn('[penbook] slide conversion failed', conversionError);
    await supabase.from('lesson_resources').update({ conversion_status: 'failed' }).eq('id', resource.id);
  }
}

export function useLessonResources(classId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lesson-resources', classId],
    queryFn: async (): Promise<LessonResource[]> => {
      const { data, error } = await supabase
        .from('lesson_resources')
        .select('*')
        .eq('class_id', classId)
        .order('week_number', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resources = query.data ?? [];

  const countByWeek = new Map<number, number>();
  for (const resource of resources) {
    countByWeek.set(resource.week_number, (countByWeek.get(resource.week_number) ?? 0) + 1);
  }

  const recentlyUpdated = [...resources]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 4);

  const totalBytes = resources.reduce((sum, r) => sum + (r.size_bytes ?? 0), 0);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lesson-resources', classId] });

  const uploadFile = useMutation({
    mutationFn: async (input: {
      weekNumber: number;
      uri: string;
      filename: string;
      mimeType: string | null;
      size: number | null;
    }) => {
      const response = await fetch(input.uri);
      const blob = await response.blob();
      const fileType = inferFileType(input.mimeType);
      const path = `${classId}/${input.weekNumber}/${input.weekNumber}-${Date.now()}-${input.filename}`;

      await uploadImageBlob(path, blob, input.mimeType ?? 'application/octet-stream');

      const canConvert = (fileType === 'pdf' || fileType === 'image') && SLIDES_SUPPORTED;

      const { data: resource, error } = await supabase
        .from('lesson_resources')
        .insert({
          class_id: classId,
          week_number: input.weekNumber,
          title: titleFromFilename(input.filename),
          file_type: fileType,
          storage_path: path,
          size_bytes: input.size,
          conversion_status: canConvert ? 'pending' : 'none',
        })
        .select()
        .single();
      if (error) throw error;

      if (canConvert) await convertToSlides(resource, blob);

      return resource;
    },
    onSuccess: invalidate,
  });

  const retryConversion = useMutation({
    mutationFn: async (resource: LessonResource) => {
      if (!resource.storage_path) throw new Error('No file to convert.');

      // Clear any partial slides from an earlier interrupted attempt — retrying without
      // this would collide with the (resource_id, position) unique constraint.
      await supabase.from('lesson_slides').delete().eq('resource_id', resource.id);
      await supabase
        .from('lesson_resources')
        .update({ conversion_status: 'pending' })
        .eq('id', resource.id);

      const { data: signed, error: signError } = await supabase.storage
        .from('lesson-files')
        .createSignedUrl(resource.storage_path, 3600);
      if (signError || !signed) throw signError ?? new Error('Could not access the file.');

      const response = await fetch(signed.signedUrl);
      const blob = await response.blob();
      await convertToSlides(resource, blob);
    },
    onSuccess: invalidate,
  });

  const renameFile = useMutation({
    mutationFn: async (input: { id: string; title: string }) => {
      const { error } = await supabase
        .from('lesson_resources')
        .update({ title: input.title })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteFile = useMutation({
    mutationFn: async (resource: LessonResource) => {
      const { data: slides } = await supabase
        .from('lesson_slides')
        .select('storage_path')
        .eq('resource_id', resource.id);

      const paths = [
        ...(resource.storage_path ? [resource.storage_path] : []),
        ...(slides ?? []).map((s) => s.storage_path).filter((p): p is string => Boolean(p)),
      ];
      if (paths.length > 0) {
        await supabase.storage.from('lesson-files').remove(paths);
      }

      const { error } = await supabase.from('lesson_resources').delete().eq('id', resource.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    ...query,
    resources,
    countByWeek,
    recentlyUpdated,
    totalBytes,
    uploadFile,
    renameFile,
    deleteFile,
    retryConversion,
  };
}
