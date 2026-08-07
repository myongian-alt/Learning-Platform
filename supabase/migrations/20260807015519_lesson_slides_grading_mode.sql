-- Makes explicit what was previously inferred purely from slide content: whether a slide is
-- auto-graded (from its fill_blank/multiple_choice objects) or manually graded by the teacher.
-- A slide with gradable objects could previously never be manually graded instead -- this gives
-- the teacher an explicit choice, changeable anytime (grading always recomputes live from
-- current settings + stored answers, same philosophy as this app's other grading fields).
create type slide_grading_mode as enum ('auto', 'manual');

alter table lesson_slides
  add column grading_mode slide_grading_mode not null default 'auto';

-- Backfill to match today's implicit behavior exactly: a slide with no gradable objects was
-- already manual-only in practice (autoGradeSlide returns null for it), so mark it 'manual'
-- rather than leaving the new column's 'auto' default to silently change nothing-graded-yet
-- slides into "auto with zero questions" (harmless either way computationally, but 'manual' is
-- the more honest label for a slide that has never had gradable content).
update lesson_slides
set grading_mode = 'manual'
where not exists (
  select 1 from jsonb_array_elements(objects) o
  where o ->> 'type' in ('fill_blank', 'multiple_choice')
);
