-- Backfill: applied directly to the remote project on 2026-08-02 (remote version
-- 20260802202054, name `fix_profiles_teacher_read_rls`) but never captured locally.
-- This file documents what's already live; running it again is a no-op (the
-- policy is dropped and recreated with its final, correct definition).
--
-- The original `profiles_classmates_read` policy (0002_harden_security.sql) meant to
-- let a teacher read a student's profile, but its teacher branch checked whether the
-- *caller* (teacher) was a class member via `private.is_class_member(c.id)` — never
-- true for a teacher, so a teacher could never read a student's name via any
-- `profiles(*)` embed. Fixed by checking the *target* profile's membership instead.
drop policy if exists profiles_classmates_read on profiles;

create policy profiles_classmates_read on profiles
  for select
  using (
    exists (
      select 1
      from class_members me
      join class_members them on them.class_id = me.class_id
      where me.student_id = auth.uid()
        and them.student_id = profiles.id
    )
    or exists (
      select 1
      from classes c
      join class_members cm on cm.class_id = c.id
      where private.is_class_teacher(c.id)
        and cm.student_id = profiles.id
    )
    or exists (
      select 1
      from classes c
      where private.is_class_teacher(c.id)
        and c.teacher_id = profiles.id
    )
  );
