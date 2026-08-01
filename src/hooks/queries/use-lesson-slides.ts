import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { LessonSlide, SlideActivityTag } from '@/types/database';

export interface ViewableSlide extends LessonSlide {
  url: string | null;
}

export function useLessonSlides(resourceId: string | null) {
  const queryClient = useQueryClient();

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

      const { data: signed, error: signError } = await supabase.storage
        .from('lesson-files')
        .createSignedUrls(
          slides.map((s) => s.storage_path),
          3600,
        );
      if (signError) throw signError;

      return slides.map((slide, i) => ({ ...slide, url: signed?.[i]?.signedUrl ?? null }));
    },
  });

  const updateSlide = useMutation({
    mutationFn: async (input: {
      id: string;
      activityTag?: SlideActivityTag | null;
      durationMinutes?: number | null;
    }) => {
      const patch: { activity_tag?: SlideActivityTag | null; duration_minutes?: number | null } =
        {};
      if ('activityTag' in input) patch.activity_tag = input.activityTag;
      if ('durationMinutes' in input) patch.duration_minutes = input.durationMinutes;

      const { error } = await supabase.from('lesson_slides').update(patch).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-slides', resourceId] });
    },
  });

  return { ...query, updateSlide };
}
