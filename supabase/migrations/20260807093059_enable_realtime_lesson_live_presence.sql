-- lesson_live_presence's postgres_changes subscription (use-lesson-live-monitor.ts's
-- persisted-presence fallback for students not currently in the ephemeral Presence channel)
-- was never opted into the publication when lesson_slides/slide_submissions were added in
-- 20260806200432 -- it silently failed to subscribe ("Unable to subscribe to changes...").
-- SELECT RLS is already correct for realtime authorization (see 20260804020000), so this is
-- just the missing publication grant.
alter publication supabase_realtime add table lesson_live_presence;
