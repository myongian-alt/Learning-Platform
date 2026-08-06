-- Per-slide grading toggle: teacher decides which slides are actually scored. Off by
-- default (matches submissions_enabled's default) -- but any slide that already has at
-- least one manual grade set keeps showing that grade, so existing work in progress
-- isn't hidden behind this new opt-in flag.
alter table lesson_slides
  add column if not exists grading_enabled boolean not null default false;

update lesson_slides
set grading_enabled = true
where id in (select distinct slide_id from slide_submissions where grade is not null);
