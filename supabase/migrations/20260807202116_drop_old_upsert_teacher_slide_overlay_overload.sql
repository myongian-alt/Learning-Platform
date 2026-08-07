-- create or replace with a changed argument list creates a NEW overload rather than replacing
-- the old one -- left both the 4-arg and 6-arg upsert_teacher_slide_overlay defined at once,
-- which makes a PostgREST RPC call with only the original named params ambiguous ("could not
-- choose the best candidate function"). Drop the superseded 4-arg overload explicitly.
drop function if exists public.upsert_teacher_slide_overlay(uuid, uuid, jsonb, text);
