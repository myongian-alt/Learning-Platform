-- Backfill: applied directly to the remote project on 2026-08-02 (remote version
-- 20260802195415, name `find_class_by_join_code_rpc`) but never captured locally.
-- This file documents what's already live; running it again is a no-op.
--
-- `classes` RLS only allows select for a teacher or existing member, so a genuinely
-- new student's join-code lookup (before membership exists) always returned zero
-- rows. This SECURITY DEFINER RPC returns only the id, bypassing that for the
-- lookup step alone — membership is still inserted through normal RLS afterward.
create or replace function public.find_class_id_by_join_code(code text)
returns uuid
language sql
stable security definer
set search_path = 'public'
as $$
  select id from classes where join_code = upper(trim(code));
$$;
