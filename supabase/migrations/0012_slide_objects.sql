-- Placed objects (text boxes, shapes, emoji stickers, comments, links, images/files) on top
-- of a slide — distinct from `annotations` (freehand pen/highlighter strokes). Same split as
-- annotations: the teacher's copy lives on `lesson_slides`, each student's own copy lives on
-- `slide_submissions`, so a student's inserted text/shapes never touch the teacher's master.

alter table lesson_slides
  add column if not exists objects jsonb not null default '[]'::jsonb;

alter table slide_submissions
  add column if not exists objects jsonb not null default '[]'::jsonb;
