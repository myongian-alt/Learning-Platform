-- Students need read access to their own custom-column scores (and the column labels) so
-- teacher-entered scores like "Participation: 95" actually reach the student's Grades tab --
-- these tables previously had teacher-only RLS, which silently returned zero rows for a
-- student caller (not an error, just an invisible feature).
create policy "gradebook_custom_columns_student_read" on gradebook_custom_columns for select
  using (private.is_class_member(class_id));

create policy "gradebook_custom_scores_student_read" on gradebook_custom_scores for select
  using (
    student_id = auth.uid()
    and exists (
      select 1 from gradebook_custom_columns c
      where c.id = gradebook_custom_scores.column_id and private.is_class_member(c.class_id)
    )
  );
