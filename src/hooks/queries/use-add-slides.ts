import { useMutation, useQueryClient } from '@tanstack/react-query';

import { renderPdfToSlides, SLIDES_SUPPORTED } from '@/lib/pdf-to-slides';
import { supabase } from '@/lib/supabase';
import type { LessonResource } from '@/types/database';

async function uploadBlob(path: string, blob: Blob, contentType: string) {
  const { error } = await supabase.storage.from('lesson-files').upload(path, blob, { contentType, upsert: true });
  if (error) throw error;
}

// Position is fetched fresh inside each mutation (not passed in as a prop) so two adds in a
// row — e.g. a teacher clicking "Add blank slide" twice quickly — can't both compute the
// same "next" position from a stale slide count and collide on the unique (resource_id,
// position) constraint.
async function nextPosition(resourceId: string): Promise<number> {
  const { data, error } = await supabase
    .from('lesson_slides')
    .select('position')
    .eq('resource_id', resourceId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.position ?? 0) + 1;
}

// Appends more slides to a lesson the teacher already has open — a blank canvas slide, or an
// additional file (image/PDF) converted the same way the original upload was.
export function useAddSlides(resource: LessonResource) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lesson-slides', resource.id] });

  const addBlankSlide = useMutation({
    mutationFn: async () => {
      const position = await nextPosition(resource.id);
      const { error } = await supabase
        .from('lesson_slides')
        .insert({ resource_id: resource.id, position, storage_path: null });
      if (error) throw error;
      return position;
    },
    onSuccess: invalidate,
  });

  const addFile = useMutation({
    mutationFn: async (input: { uri: string; filename: string; mimeType: string | null }) => {
      const response = await fetch(input.uri);
      const blob = await response.blob();
      const isImage = (input.mimeType ?? '').startsWith('image/');
      const isPdf = input.mimeType === 'application/pdf';
      const start = await nextPosition(resource.id);

      if (isImage) {
        const path = `${resource.class_id}/${resource.week_number}/slides/${resource.id}/${start}-${Date.now()}.png`;
        await uploadBlob(path, blob, input.mimeType ?? 'image/png');
        const { error } = await supabase
          .from('lesson_slides')
          .insert({ resource_id: resource.id, position: start, storage_path: path });
        if (error) throw error;
        return 1;
      }

      if (isPdf && SLIDES_SUPPORTED) {
        const pages = await renderPdfToSlides(blob);
        for (const page of pages) {
          const position = start + page.position - 1;
          const path = `${resource.class_id}/${resource.week_number}/slides/${resource.id}/${position}-${Date.now()}.png`;
          await uploadBlob(path, page.blob, 'image/png');
          const { error } = await supabase
            .from('lesson_slides')
            .insert({ resource_id: resource.id, position, storage_path: path });
          if (error) throw error;
        }
        return pages.length;
      }

      throw new Error('Only images and PDFs can be added as slides.');
    },
    onSuccess: invalidate,
  });

  return { addBlankSlide, addFile };
}
