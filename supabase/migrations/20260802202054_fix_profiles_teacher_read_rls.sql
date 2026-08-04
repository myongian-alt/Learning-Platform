-- `profiles_classmates_read` (0002_harden_security.sql) was meant to let a teacher read the
-- profile of any student enrolled in one of their classes, but its second branch checked
-- `private.is_class_member(c.id)` — which tests whether the CALLER (the teacher) is a member
-- of class c, never true for a teacher — instead of checking whether the TARGET profile
-- (profiles.id, the student being looked up) is a member. The upshot: a teacher could never
-- actually read a student's profiles row via this policy, so every `profiles(*)` embed a
-- teacher makes for their roster (useClassRoster's Students section, and the new grading
-- panel's `profiles:student_id(full_name)` join) silently resolved to null and fell back to
-- generic placeholder text instead of the student's real name.
drop policy if exists "profiles_classmates_read" on profiles;
create policy "profiles_classmates_read" on profiles for select using (
  exists (
    select 1 from class_members me
    join class_members them on them.class_id = me.class_id
    where me.student_id = auth.uid() and them.student_id = profiles.id
  )
  or exists (
    select 1 from classes c
    join class_members cm on cm.class_id = c.id
    where private.is_class_teacher(c.id) and cm.student_id = profiles.id
  )
  or exists (
    select 1 from classes c
    where private.is_class_teacher(c.id) and c.teacher_id = profiles.id
  )
);
;
