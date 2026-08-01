import { useMutation, useQueryClient } from '@tanstack/react-query';

import { generateJoinCode } from '@/lib/codes';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';

export interface CreateClassWizardInput {
  term: string;
  grade: string;
  sections: string[];
  subject: string;
}

function composeClassName({ grade, sections, subject }: CreateClassWizardInput) {
  const gradeAndSections = sections.length > 0 ? `${grade} ${sections.join(', ')}` : grade;
  return `${gradeAndSections} · ${subject}`;
}

export function useCreateClassWizard() {
  const teacherId = useAuthStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateClassWizardInput) => {
      const { data, error } = await supabase
        .from('classes')
        .insert({
          name: composeClassName(input),
          teacher_id: teacherId!,
          join_code: generateJoinCode(),
          term: input.term,
          grade: input.grade,
          section: input.sections,
          subject: input.subject,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-classes', teacherId] });
    },
  });
}
