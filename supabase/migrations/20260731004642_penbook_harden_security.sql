-- Hardening pass, addressing Supabase advisor findings after 0001_init.sql:
--   1. `vector` extension landed in `public` on install; move it to `extensions`.
--   2. RLS helper functions lived in `public`, so PostgREST auto-exposed them as
--      public RPC endpoints (e.g. /rest/v1/rpc/is_class_teacher), leaking
--      class-membership booleans to any signed-in (or anonymous) caller. Move
--      them into a `private` schema, which PostgREST doesn't expose, and
--      re-point every policy at the relocated functions.
--   3. `organizations` had RLS enabled with no policy at all (fully locked) —
--      add a basic signed-in-read policy.

alter extension vector set schema extensions;

create schema if not exists private;

create function private.is_class_teacher(target_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from classes c
    where c.id = target_class_id
      and (c.teacher_id = auth.uid()
           or exists (select 1 from co_teachers ct where ct.class_id = c.id and ct.teacher_id = auth.uid()))
  );
$$;

create function private.is_class_member(target_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from class_members cm
    where cm.class_id = target_class_id and cm.student_id = auth.uid()
  );
$$;

create function private.assignment_class_id(target_assignment_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select class_id from assignments where id = target_assignment_id;
$$;

create function private.page_assignment_id(target_page_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select assignment_id from assignment_pages where id = target_page_id;
$$;

revoke execute on function private.is_class_teacher(uuid) from public;
revoke execute on function private.is_class_member(uuid) from public;
revoke execute on function private.assignment_class_id(uuid) from public;
revoke execute on function private.page_assignment_id(uuid) from public;
grant execute on function private.is_class_teacher(uuid) to authenticated;
grant execute on function private.is_class_member(uuid) to authenticated;
grant execute on function private.assignment_class_id(uuid) to authenticated;
grant execute on function private.page_assignment_id(uuid) to authenticated;

drop policy if exists "profiles_classmates_read" on profiles;
drop policy if exists "classes_teacher_all" on classes;
drop policy if exists "classes_member_read" on classes;
drop policy if exists "class_members_teacher_all" on class_members;
drop policy if exists "co_teachers_all" on co_teachers;
drop policy if exists "assignments_teacher_all" on assignments;
drop policy if exists "assignments_student_read" on assignments;
drop policy if exists "pages_teacher_all" on assignment_pages;
drop policy if exists "pages_student_read" on assignment_pages;
drop policy if exists "questions_teacher_all" on questions;
drop policy if exists "questions_student_read" on questions;
drop policy if exists "submissions_teacher_read" on submissions;
drop policy if exists "submissions_teacher_grade" on submissions;
drop policy if exists "responses_teacher_read" on responses;
drop policy if exists "strokes_teacher_all" on canvas_strokes;
drop policy if exists "strokes_classmate_read" on canvas_strokes;
drop policy if exists "help_requests_teacher_all" on help_requests;
drop policy if exists "leaderboard_teacher_read" on leaderboard_entries;
drop policy if exists "lms_connections_teacher_all" on lms_connections;

create policy "profiles_classmates_read" on profiles for select using (
  exists (
    select 1 from class_members me
    join class_members them on them.class_id = me.class_id
    where me.student_id = auth.uid() and them.student_id = profiles.id
  )
  or exists (
    select 1 from classes c
    where private.is_class_teacher(c.id) and (c.teacher_id = profiles.id or private.is_class_member(c.id))
  )
);

create policy "classes_teacher_all" on classes for all using (private.is_class_teacher(id)) with check (teacher_id = auth.uid());
create policy "classes_member_read" on classes for select using (private.is_class_member(id));

create policy "class_members_teacher_all" on class_members for all using (private.is_class_teacher(class_id));

create policy "co_teachers_all" on co_teachers for all using (private.is_class_teacher(class_id));

create policy "assignments_teacher_all" on assignments for all using (private.is_class_teacher(class_id));
create policy "assignments_student_read" on assignments for select using (
  status = 'published' and private.is_class_member(class_id)
);

create policy "pages_teacher_all" on assignment_pages for all using (private.is_class_teacher(private.assignment_class_id(assignment_id)));
create policy "pages_student_read" on assignment_pages for select using (private.is_class_member(private.assignment_class_id(assignment_id)));

create policy "questions_teacher_all" on questions for all using (private.is_class_teacher(private.assignment_class_id(private.page_assignment_id(page_id))));
create policy "questions_student_read" on questions for select using (private.is_class_member(private.assignment_class_id(private.page_assignment_id(page_id))));

create policy "submissions_teacher_read" on submissions for select using (private.is_class_teacher(private.assignment_class_id(assignment_id)));
create policy "submissions_teacher_grade" on submissions for update using (private.is_class_teacher(private.assignment_class_id(assignment_id)));

create policy "responses_teacher_read" on responses for select using (
  exists (
    select 1 from submissions s
    where s.id = submission_id and private.is_class_teacher(private.assignment_class_id(s.assignment_id))
  )
);

create policy "strokes_teacher_all" on canvas_strokes for all using (
  private.is_class_teacher(private.assignment_class_id(private.page_assignment_id(page_id)))
) with check (
  author_role = 'teacher' and author_id = auth.uid()
  and private.is_class_teacher(private.assignment_class_id(private.page_assignment_id(page_id)))
);
create policy "strokes_classmate_read" on canvas_strokes for select using (
  private.is_class_member(private.assignment_class_id(private.page_assignment_id(page_id)))
);

create policy "help_requests_teacher_all" on help_requests for all using (private.is_class_teacher(private.assignment_class_id(assignment_id)));

create policy "leaderboard_teacher_read" on leaderboard_entries for select using (private.is_class_teacher(private.assignment_class_id(assignment_id)));

create policy "lms_connections_teacher_all" on lms_connections for all using (private.is_class_teacher(class_id));

drop function if exists public.is_class_teacher(uuid);
drop function if exists public.is_class_member(uuid);
drop function if exists public.assignment_class_id(uuid);
drop function if exists public.page_assignment_id(uuid);

create policy "organizations_signed_in_read" on organizations for select using (auth.uid() is not null);
;
