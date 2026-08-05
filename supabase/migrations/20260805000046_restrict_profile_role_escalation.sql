-- `profiles_self_update` had no WITH CHECK, so any signed-in user could call the
-- Supabase client directly (bypassing the app UI entirely) and update their own
-- `role`/`organization_id`/`id` to anything, including granting themselves
-- teacher/admin access. This app has no feature that ever changes those columns
-- after signup, so a trigger simply pins them to their existing value on any
-- self-update, regardless of what a client sends.
create or replace function private.protect_profile_identity_columns()
returns trigger
language plpgsql
as $$
begin
  new.id := old.id;
  new.role := old.role;
  new.organization_id := old.organization_id;
  return new;
end;
$$;

create trigger protect_profile_identity_columns
  before update on profiles
  for each row
  execute function private.protect_profile_identity_columns();

-- `profiles_insert_self` only checked `id = auth.uid()` — the sign-up UI only ever
-- offers 'teacher'/'student', but nothing stopped a raw API call from inserting a
-- profile with role='admin' directly. Restrict self-service signup to the two
-- roles the app actually lets a user choose; admin provisioning (if ever needed)
-- goes through the service role, which bypasses RLS entirely.
drop policy "profiles_insert_self" on profiles;

create policy "profiles_insert_self" on profiles for insert
  with check (id = auth.uid() and role in ('teacher', 'student'));
