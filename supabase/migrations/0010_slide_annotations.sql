-- Teacher-authored drawing/annotation layer on top of each slide (pen, highlighter,
-- eraser strokes). Stored as a single jsonb array rather than one row per stroke like
-- `canvas_strokes` — slides have exactly one author (the teacher preparing the
-- lesson), not the multi-author student/teacher split that table models, so a simple
-- versioned blob is the right shape here.

alter table lesson_slides
  add column if not exists annotations jsonb not null default '[]'::jsonb;
