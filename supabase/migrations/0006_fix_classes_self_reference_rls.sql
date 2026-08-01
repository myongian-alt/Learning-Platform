-- Fixes a second bug from 0002_harden_security.sql, uncovered by the schema
-- USAGE fix in 0005: `classes_teacher_all`'s USING clause called
-- `private.is_class_teacher(id)`, which queries `classes` itself to check
-- ownership. That's fine for OTHER tables' policies (e.g. assignments
-- checking `private.is_class_teacher(class_id)` looks up a different table),
-- but on `classes`' own policy it's a self-referential subquery back into the
-- table being modified. Postgres re-checks USING against the row returned by
-- INSERT ... RETURNING, and that self-referential lookup doesn't reliably see
-- the row the same command just inserted — so every class creation failed
-- with "new row violates row-level security policy for table classes" even
-- though the row and its teacher_id were entirely correct.
--
-- Fix: inline the ownership check against the row's own columns instead of
-- routing through a subquery back into `classes`.

drop policy if exists "classes_teacher_all" on classes;

create policy "classes_teacher_all" on classes for all using (
  teacher_id = auth.uid()
  or exists (select 1 from co_teachers ct where ct.class_id = classes.id and ct.teacher_id = auth.uid())
) with check (teacher_id = auth.uid());
