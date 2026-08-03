import type { SlideAnswers, SlideObject } from '@/hooks/queries/use-lesson-slides';

export type GradableObject = Extract<SlideObject, { type: 'fill_blank' | 'multiple_choice' }>;

export interface AutoGradeResult {
  correct: number;
  total: number;
  percent: number;
}

export function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export function isAnswerCorrect(obj: GradableObject, given: string | number | undefined): boolean {
  if (given === undefined) return false;
  if (obj.type === 'fill_blank')
    return normalizeAnswer(String(given)) === normalizeAnswer(obj.answer);
  return obj.correctIndex !== null && Number(given) === obj.correctIndex;
}

export function gradableObjects(objects: SlideObject[]): GradableObject[] {
  return objects.filter(
    (o): o is GradableObject => o.type === 'fill_blank' || o.type === 'multiple_choice',
  );
}

// Whole-slide auto-grade across every fill_blank/multiple_choice object on it. Returns
// null when the slide has none (so callers can tell "no auto-gradable content" apart
// from "answered everything wrong").
export function autoGradeSlide(
  objects: SlideObject[],
  answers: SlideAnswers,
): AutoGradeResult | null {
  const gradable = gradableObjects(objects);
  if (gradable.length === 0) return null;
  const correct = gradable.filter((o) => isAnswerCorrect(o, answers[o.id])).length;
  return {
    correct,
    total: gradable.length,
    percent: Math.round((correct / gradable.length) * 100),
  };
}
