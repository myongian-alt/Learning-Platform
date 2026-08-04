-- The "join a class with a code" flow was completely broken: `classes` RLS only allows
-- select for a class's teacher or an already-joined member (see 0002_harden_security.sql),
-- so a brand-new student's initial join_code -> class_id lookup always returned zero rows,
-- surfacing as "No class found with that code." even for a correct code. A SECURITY DEFINER
-- RPC (must live in `public`, not `private`, so PostgREST actually exposes it as callable)
-- resolves just the id for a given code, without exposing any other class data, and the
-- follow-up class_members insert stays governed by its own existing self-join RLS policy.
create function public.find_class_id_by_join_code(code text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from classes where join_code = upper(trim(code));
$$;

revoke all on function public.find_class_id_by_join_code(text) from public;
grant execute on function public.find_class_id_by_join_code(text) to authenticated;
;
