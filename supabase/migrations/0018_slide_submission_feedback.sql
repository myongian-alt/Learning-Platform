-- A per-submission teacher comment, alongside the existing numeric `grade`
-- (0011/0013). Covered by the existing `slide_submissions_teacher_grade` update
-- policy and `slide_submissions_student_select` read policy — no new RLS needed.
alter table slide_submissions
  add column feedback text;
