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

export interface WeightedItem {
  id: string;
  points: number | null | undefined;
}

// Resolves each item's point weight out of 100: a manually-set `points` value is kept as-is;
// the remaining budget (100 minus the manual sum, floored at 0) is split evenly across the
// un-weighted items via integer division, with the LAST such item absorbing the remainder —
// so the map's values always sum to exactly 100 (e.g. 3 auto items with no manual weights get
// 33/33/34, never a fractional or short/over total). If manual weights alone already exceed 100
// (shouldn't happen — the authoring UIs clamp this — but defensively handled here too), they're
// scaled down proportionally to fit exactly 100. Shape-agnostic (just `{id, points}`) so both a
// slide's placed fill_blank/multiple_choice objects and an attached quiz's questions can share
// this one algorithm instead of each reimplementing it.
export function resolvePointWeights(items: WeightedItem[]): Map<string, number> {
  const map = new Map<string, number>();
  if (items.length === 0) return map;

  const manual = items.filter((o) => o.points != null);
  const auto = items.filter((o) => o.points == null);
  let manualSum = manual.reduce((sum, o) => sum + (o.points ?? 0), 0);

  if (manualSum > 100) {
    const scale = 100 / manualSum;
    for (const o of manual) map.set(o.id, Math.round((o.points ?? 0) * scale));
    manualSum = 100;
  } else {
    for (const o of manual) map.set(o.id, o.points ?? 0);
  }

  const remaining = Math.max(0, 100 - manualSum);
  if (auto.length > 0) {
    const share = Math.floor(remaining / auto.length);
    auto.forEach((o, i) => {
      const isLast = i === auto.length - 1;
      map.set(o.id, isLast ? remaining - share * (auto.length - 1) : share);
    });
  }

  return map;
}

// The most a single item could have its manual points set to right now, without pushing the
// total manual weight over 100 — every OTHER manually-weighted item's points stay fixed, so
// this is just 100 minus their sum. Used to clamp a points input so a teacher can never type a
// value that would overflow the 100-point budget.
export function maxAssignableWeight(items: WeightedItem[], itemId: string): number {
  const othersManualSum = items
    .filter((o) => o.id !== itemId && o.points != null)
    .reduce((sum, o) => sum + (o.points ?? 0), 0);
  return Math.max(0, 100 - othersManualSum);
}

// Thin adapters over `resolvePointWeights`/`maxAssignableWeight` for a slide's own gradable
// objects specifically (the more common call site — most callers just have `SlideObject[]`).
export function effectivePointsMap(objects: SlideObject[]): Map<string, number> {
  return resolvePointWeights(gradableObjects(objects).map((o) => ({ id: o.id, points: o.points })));
}

export function maxAssignablePoints(objects: SlideObject[], objectId: string): number {
  return maxAssignableWeight(
    gradableObjects(objects).map((o) => ({ id: o.id, points: o.points })),
    objectId,
  );
}

// Whole-slide auto-grade across every fill_blank/multiple_choice object on it. Returns
// null when the slide has none (so callers can tell "no auto-gradable content" apart
// from "answered everything wrong"). Percent is the sum of effective points earned from
// correctly-answered questions — see `effectivePointsMap` for how each question's weight
// is resolved, since this is no longer a simple correct/total ratio once weights differ.
export function autoGradeSlide(
  objects: SlideObject[],
  answers: SlideAnswers,
): AutoGradeResult | null {
  const gradable = gradableObjects(objects);
  if (gradable.length === 0) return null;
  const pointsMap = effectivePointsMap(objects);
  const correct = gradable.filter((o) => isAnswerCorrect(o, answers[o.id])).length;
  const percent = gradable.reduce(
    (sum, o) => sum + (isAnswerCorrect(o, answers[o.id]) ? (pointsMap.get(o.id) ?? 0) : 0),
    0,
  );
  return {
    correct,
    total: gradable.length,
    percent: Math.round(percent),
  };
}
