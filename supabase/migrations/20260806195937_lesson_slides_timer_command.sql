-- Shared live-timer state per slide: 'idle' (not armed/reset), 'running', or 'paused'. A
-- teacher's Start/Pause/Reset writes this column; every viewer (teacher and each student)
-- reacts to it changing by driving their OWN local countdown -- a self-paced student who
-- mounts the slide while this is already 'running' starts a fresh full countdown right then,
-- rather than one shared classroom-wide deadline. One column (not a per-student anchor) is
-- enough since a teacher presents one lesson at a time; re-arming later resets it via Reset.
alter table lesson_slides
  add column if not exists timer_command text not null default 'idle'
  check (timer_command in ('idle', 'running', 'paused'));
