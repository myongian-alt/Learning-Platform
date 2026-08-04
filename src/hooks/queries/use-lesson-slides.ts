import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { renderPdfToSlides, SLIDES_SUPPORTED } from '@/lib/pdf-to-slides';
import { supabase } from '@/lib/supabase';
import type { LessonSlide, SlideActivityTag, SlidePacingMode } from '@/types/database';

export interface ViewableSlide extends LessonSlide {
  url: string | null;
}

export interface SlideStroke {
  id: string;
  tool: 'draw' | 'highlight' | 'erase';
  color: string;
  strokeWidth: number;
  points: { x: number; y: number }[];
}

export type SlideObjectShape = 'rectangle' | 'ellipse' | 'line' | 'arrow';

// Placed, discrete items (as opposed to freehand `SlideStroke`s) — each independently
// selectable, draggable, and (except comments/emoji) resizable. `fill_blank` and
// `multiple_choice` are authored by the teacher like any other object, but a student's
// answer to them is stored separately (see `SlideAnswers`) — everyone sees the same
// question, but each student's own response is theirs alone.
export type SlideObject =
  | { id: string; type: 'text'; x: number; y: number; width: number; height: number; text: string; color: string; fontSize: number }
  | {
      id: string;
      type: 'shape';
      shape: SlideObjectShape;
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      strokeWidth: number;
    }
  | { id: string; type: 'emoji'; x: number; y: number; size: number; emoji: string }
  | { id: string; type: 'comment'; x: number; y: number; text: string }
  | { id: string; type: 'link'; x: number; y: number; width: number; url: string; label: string }
  | { id: string; type: 'fill_blank'; x: number; y: number; width: number; height: number; prompt: string; answer: string }
  | {
      id: string;
      type: 'multiple_choice';
      x: number;
      y: number;
      width: number;
      height: number;
      prompt: string;
      options: string[];
      correctIndex: number | null;
    };

// A student's answers to question objects, keyed by the question's SlideObject id. A
// fill_blank answer is the typed text; a multiple_choice answer is the chosen option index.
export type SlideAnswers = Record<string, string | number>;

export function useLessonSlides(resourceId: string | null) {
  const queryClient = useQueryClient();

  const getNextSlidePosition = async () => {
    const { data, error } = await supabase
      .from('lesson_slides')
      .select('position')
      .eq('resource_id', resourceId!)
      .order('position', { ascending: false })
      .limit(1);
    if (error) throw error;
    return (data?.[0]?.position ?? 0) + 1;
  };

  const query = useQuery({
    queryKey: ['lesson-slides', resourceId],
    enabled: Boolean(resourceId),
    queryFn: async (): Promise<ViewableSlide[]> => {
      const { data: slides, error } = await supabase
        .from('lesson_slides')
        .select('*')
        .eq('resource_id', resourceId!)
        .order('position', { ascending: true });
      if (error) throw error;
      if (!slides || slides.length === 0) return [];

      // Blank slides (added via the "+" menu) have no storage_path — only sign the ones
      // that actually have an image, then map back by path so indexes can't get crossed.
      const pathed = slides.filter((s): s is typeof s & { storage_path: string } => Boolean(s.storage_path));
      const signed =
        pathed.length > 0
          ? await supabase.storage.from('lesson-files').createSignedUrls(
              pathed.map((s) => s.storage_path),
              3600,
            )
          : { data: [], error: null };
      if (signed.error) throw signed.error;

      const urlByPath = new Map(pathed.map((s, i) => [s.storage_path, signed.data?.[i]?.signedUrl ?? null]));
      return slides.map((slide) => ({
        ...slide,
        url: slide.storage_path ? (urlByPath.get(slide.storage_path) ?? null) : null,
      }));
    },
  });

  const updateSlide = useMutation({
    mutationFn: async (input: {
      id: string;
      activityTag?: SlideActivityTag | null;
      durationMinutes?: number | null;
      submissionsEnabled?: boolean;
    }) => {
      const patch: {
        activity_tag?: SlideActivityTag | null;
        duration_minutes?: number | null;
        submissions_enabled?: boolean;
      } = {};
      if ('activityTag' in input) patch.activity_tag = input.activityTag;
      if ('durationMinutes' in input) patch.duration_minutes = input.durationMinutes;
      if ('submissionsEnabled' in input) patch.submissions_enabled = input.submissionsEnabled;

      const { error } = await supabase.from('lesson_slides').update(patch).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-slides', resourceId] });
    },
  });

  // Applies to a whole selection at once (the thumbnail grid's "select some/all slides"
  // bulk action) rather than one slide at a time like updateSlide — a single `.update().in()`
  // call, evaluated per-row against the same RLS policy as any other teacher slide edit.
  const updateSlidesPacing = useMutation({
    mutationFn: async (input: { ids: string[]; pacingMode: SlidePacingMode }) => {
      const { error } = await supabase
        .from('lesson_slides')
        .update({ pacing_mode: input.pacingMode })
        .in('id', input.ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-slides', resourceId] });
    },
  });

  // Separate from updateSlide deliberately: strokes save frequently while the teacher is
  // actively drawing, and invalidating/refetching the whole slide list on every stroke would
  // fight the canvas's own local state. The canvas is the source of truth during a drawing
  // session — this just writes it through.
  const saveAnnotations = useMutation({
    mutationFn: async (input: { id: string; annotations: SlideStroke[] }) => {
      const { error } = await supabase
        .from('lesson_slides')
        .update({ annotations: input.annotations as never })
        .eq('id', input.id);
      if (error) throw error;
    },
  });

  // Same reasoning as saveAnnotations — placed objects (text/shapes/emoji/comments/links)
  // change on every drag/resize/edit, so this must not invalidate the slide list either.
  const saveObjects = useMutation({
    mutationFn: async (input: { id: string; objects: SlideObject[] }) => {
      const { error } = await supabase
        .from('lesson_slides')
        .update({ objects: input.objects as never })
        .eq('id', input.id);
      if (error) throw error;
    },
  });

  const addBlankSlide = useMutation({
    mutationFn: async () => {
      if (!resourceId) throw new Error('No lesson selected.');
      const position = await getNextSlidePosition();
      const { error } = await supabase
        .from('lesson_slides')
        .insert({ resource_id: resourceId, position, storage_path: null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-slides', resourceId] });
    },
  });

  const appendSlidesFromFile = useMutation({
    mutationFn: async (input: { uri: string; filename: string; mimeType: string | null }) => {
      if (!resourceId) throw new Error('No lesson selected.');

      const response = await fetch(input.uri);
      const blob = await response.blob();
      const mimeType = input.mimeType ?? blob.type ?? null;
      const lower = input.filename.toLowerCase();
      const isImage = Boolean(mimeType?.startsWith('image/'));
      const isPdf = mimeType === 'application/pdf' || lower.endsWith('.pdf');

      if (!isImage && !isPdf) {
        throw new Error('Only PDF or image files can be appended as lesson slides.');
      }
      if (!SLIDES_SUPPORTED) {
        throw new Error('Slide conversion is not supported on this platform.');
      }

      const { data: resource, error: resourceError } = await supabase
        .from('lesson_resources')
        .select('id,class_id,week_number')
        .eq('id', resourceId)
        .single();
      if (resourceError || !resource) {
        throw resourceError ?? new Error('Could not load the lesson resource.');
      }

      let position = await getNextSlidePosition();

      if (isImage) {
        const extension = lower.split('.').pop() || 'png';
        const path = `${resource.class_id}/${resource.week_number}/slides/${resource.id}/${position}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('lesson-files')
          .upload(path, blob, { contentType: mimeType ?? 'image/png', upsert: true });
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from('lesson_slides')
          .insert({ resource_id: resource.id, position, storage_path: path });
        if (insertError) throw insertError;
        return;
      }

      const slides = await renderPdfToSlides(blob);
      for (const slide of slides) {
        const currentPosition = position + slide.position - 1;
        const path = `${resource.class_id}/${resource.week_number}/slides/${resource.id}/${currentPosition}.png`;
        const { error: uploadError } = await supabase.storage
          .from('lesson-files')
          .upload(path, slide.blob, { contentType: 'image/png', upsert: true });
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from('lesson_slides')
          .insert({ resource_id: resource.id, position: currentPosition, storage_path: path });
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-slides', resourceId] });
    },
  });

  return {
    ...query,
    updateSlide,
    updateSlidesPacing,
    saveAnnotations,
    saveObjects,
    addBlankSlide,
    appendSlidesFromFile,
  };
}
