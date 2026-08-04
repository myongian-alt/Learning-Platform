-- Tracks the latest lesson/slide context for each student in a class so teachers can
-- monitor who is live, who drifted away briefly, and who has been inactive long enough
-- to need follow-up. Realtime Presence handles instant online/offline changes; this table
-- persists the latest snapshot so inactivity windows survive reconnects and refreshes.

create table lesson_live_presence (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  resource_id uuid references lesson_resources(id) on delete cascade,
  slide_id uuid references lesson_slides(id) on delete set null,
  slide_index integer,
  pacing_mode slide_pacing_mode,
  is_present boolean not null default true,
  following_teacher boolean not null default false,
  submissions_enabled boolean not null default false,
  last_event_type text,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create index lesson_live_presence_class_present_idx
  on lesson_live_presence (class_id, is_present);

create index lesson_live_presence_class_resource_idx
  on lesson_live_presence (class_id, resource_id);

create index lesson_live_presence_class_slide_idx
  on lesson_live_presence (class_id, slide_id);

create index lesson_live_presence_student_idx
  on lesson_live_presence (student_id);

create index lesson_live_presence_last_seen_idx
  on lesson_live_presence (last_seen_at desc);

alter table lesson_live_presence enable row level security;

create policy "lesson_live_presence_teacher_select" on lesson_live_presence for select
  using (private.is_class_teacher(class_id));

create policy "lesson_live_presence_student_select" on lesson_live_presence for select
  using (student_id = auth.uid() and private.is_class_member(class_id));

create policy "lesson_live_presence_student_insert" on lesson_live_presence for insert
  with check (student_id = auth.uid() and private.is_class_member(class_id));

create policy "lesson_live_presence_student_update" on lesson_live_presence for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and private.is_class_member(class_id));