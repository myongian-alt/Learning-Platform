-- Backfill: applied directly to the remote project on 2026-08-02 (remote version
-- 20260802204007, name `restrict_join_code_lookup_to_authenticated`) but never
-- captured locally. This file documents what's already live; running it again is
-- a no-op.
--
-- Supabase's project-level default privileges grant `anon` execute on new
-- public-schema functions independent of a plain `revoke all from public`, so the
-- join-code lookup RPC needed an explicit revoke to keep it authenticated-only.
revoke execute on function public.find_class_id_by_join_code(text) from anon;
revoke execute on function public.find_class_id_by_join_code(text) from public;
grant execute on function public.find_class_id_by_join_code(text) to authenticated;
