-- Strokes/objects/answers must always reach the teacher regardless of whether the teacher has
-- turned "submissions" on for this slide -- that flag now only gates the formal Submit action
-- (enforced in the UI, see slide-viewer.tsx's studentSubmitButton), not whether a student's
-- in-progress activity is visible/recorded at all.
drop policy "slide_submissions_student_insert" on slide_submissions;
create policy "slide_submissions_student_insert" on slide_submissions for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from lesson_slides s
      join lesson_resources r on r.id = s.resource_id
      where s.id = slide_submissions.slide_id and private.is_class_member(r.class_id)
    )
  );

drop policy "slide_submissions_student_update" on slide_submissions;
create policy "slide_submissions_student_update" on slide_submissions for update
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from lesson_slides s
      join lesson_resources r on r.id = s.resource_id
      where s.id = slide_submissions.slide_id and private.is_class_member(r.class_id)
    )
  );
