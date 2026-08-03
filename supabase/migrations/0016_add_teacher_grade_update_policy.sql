-- Backfill: applied directly to the remote project on 2026-08-02 (remote version
-- 20260802203443, name `add_teacher_grade_update_policy`) but never captured locally.
-- This file documents what's already live; running it again is a no-op.
--
-- `slide_submissions` had a teacher-select policy but no teacher-update policy at
-- all, so grading silently no-opped (0 rows affected, no thrown error since the
-- mutation didn't chain `.select()`) even though the UI showed the slider moving.
create policy slide_submissions_teacher_grade on slide_submissions
  for update
  using (
    exists (
      select 1
      from lesson_slides s
      join lesson_resources r on r.id = s.resource_id
      where s.id = slide_submissions.slide_id
        and private.is_class_teacher(r.class_id)
    )
  )
  with check (
    exists (
      select 1
      from lesson_slides s
      join lesson_resources r on r.id = s.resource_id
      where s.id = slide_submissions.slide_id
        and private.is_class_teacher(r.class_id)
    )
  );
