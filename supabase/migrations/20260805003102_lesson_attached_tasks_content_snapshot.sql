-- Snapshot of the specific AI-generated card's content at the moment a teacher attaches it
-- (video info / quiz info / mcq array) — a snapshot, not a live reference to
-- lesson_ai_resources, so regenerating doesn't silently change what's already attached.
alter table lesson_attached_tasks add column content jsonb;
