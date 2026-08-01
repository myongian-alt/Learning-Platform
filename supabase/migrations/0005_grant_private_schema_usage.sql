-- Fixes a standing bug from 0002_harden_security.sql: it moved the RLS helper
-- functions into a `private` schema (so PostgREST wouldn't expose them as public
-- RPC endpoints) and granted EXECUTE on each function to `authenticated`, but
-- never granted USAGE on the `private` SCHEMA itself. Without schema USAGE,
-- Postgres can't even resolve `private.is_class_teacher(...)` for that role, so
-- every policy referencing a `private.*` helper — i.e. almost every RLS policy
-- in this app — throws "permission denied for schema private" whenever it's
-- evaluated in a SELECT-visibility context (plain SELECTs, and the implicit
-- visibility recheck Postgres does after INSERT/UPDATE ... RETURNING).
--
-- This went unnoticed because until now nothing had exercised an authenticated
-- INSERT ... RETURNING against a `private.*`-guarded policy end-to-end (e.g.
-- classes, assignments, submissions, canvas_strokes all hit this).

grant usage on schema private to authenticated;
