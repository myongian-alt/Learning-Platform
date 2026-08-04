-- Supabase's project-level default privileges apparently grant EXECUTE on new public-schema
-- functions to `anon` independent of the plain `revoke all from public` in the prior
-- migration (the advisor still flagged anon as able to call this). Only a signed-in student
-- should ever look up a class by join code, so revoke from anon explicitly.
revoke execute on function public.find_class_id_by_join_code(text) from anon;
;
