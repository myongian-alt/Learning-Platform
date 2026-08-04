-- Blank slides have no source image, so storage_path must be optional.
alter table lesson_slides
  alter column storage_path drop not null;

-- Per-student grading (0-100) and question-object answers (keyed by the teacher's question
-- object id, since the question itself lives in the teacher's authored `objects` array on
-- lesson_slides — only the student's answer is per-student data).
alter table slide_submissions
  add column if not exists grade smallint,
  add column if not exists answers jsonb not null default '{}'::jsonb;

alter table slide_submissions
  add constraint slide_submissions_grade_range check (grade is null or (grade >= 0 and grade <= 100));
;
