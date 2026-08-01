-- Lets teachers tag each slide with the kind of classroom activity it represents
-- (warm-up, guided practice, exit ticket, ...) and assign a duration, so the
-- Lessons screen can tint the slide, label the activity type, and run a
-- countdown timer when presenting it.

create type slide_activity_tag as enum (
  'title_objectives',
  'warm_up',
  'main_idea',
  'solved_examples',
  'guided_practice',
  'independent_activity',
  'group_activity',
  'challenge_extra',
  'exit_ticket'
);

alter table lesson_slides
  add column if not exists activity_tag slide_activity_tag,
  add column if not exists duration_minutes smallint;
