-- slide_submissions had a teacher SELECT policy ("who has completed this slide") and a
-- student-only UPDATE policy (their own annotations/objects/answers/submitted_at), but no
-- UPDATE policy for the teacher at all — so the grading slider's `.update({ grade })` call
-- was silently affecting 0 rows (RLS blocks it, and the Supabase client doesn't surface that
-- as a thrown error when no `.select()` is chained), and the UI's optimistic slider position
-- never actually persisted. Mirrors the existing teacher-select policy's class-ownership
-- check (same join through lesson_slides -> lesson_resources -> classes).
create policy "slide_submissions_teacher_grade" on slide_submissions for update
  using (
    exists (
      select 1 from lesson_slides s
      join lesson_resources r on r.id = s.resource_id
      where s.id = slide_submissions.slide_id and private.is_class_teacher(r.class_id)
    )
  )
  with check (
    exists (
      select 1 from lesson_slides s
      join lesson_resources r on r.id = s.resource_id
      where s.id = slide_submissions.slide_id and private.is_class_teacher(r.class_id)
    )
  );
;
