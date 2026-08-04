drop policy if exists "classes_teacher_all" on classes;

create policy "classes_teacher_all" on classes for all using (
  teacher_id = auth.uid()
  or exists (select 1 from co_teachers ct where ct.class_id = classes.id and ct.teacher_id = auth.uid())
) with check (teacher_id = auth.uid());;
