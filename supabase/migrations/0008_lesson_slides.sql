-- Uploaded PDFs (and images) get converted into viewable "slides" — one row per
-- page, pointing at a rendered image in Storage. `conversion_status` tracks the
-- (client-side, PDF.js-driven) render pipeline so the UI can show a
-- "Converting…" state instead of a broken viewer while it's in progress.

create type lesson_conversion_status as enum ('none', 'pending', 'ready', 'failed');

alter table lesson_resources
  add column if not exists conversion_status lesson_conversion_status not null default 'none';

create table lesson_slides (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references lesson_resources(id) on delete cascade,
  position int not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (resource_id, position)
);

create index lesson_slides_resource_idx on lesson_slides (resource_id, position);

alter table lesson_slides enable row level security;

-- Same ownership chain as lesson_resources (through resource_id -> class_id), not a
-- self-reference, so this is safe against the RETURNING-visibility pitfall found earlier.
create policy "lesson_slides_teacher_all" on lesson_slides for all
  using (
    exists (
      select 1 from lesson_resources r
      where r.id = lesson_slides.resource_id and private.is_class_teacher(r.class_id)
    )
  )
  with check (
    exists (
      select 1 from lesson_resources r
      where r.id = lesson_slides.resource_id and private.is_class_teacher(r.class_id)
    )
  );

create policy "lesson_slides_student_read" on lesson_slides for select
  using (
    exists (
      select 1 from lesson_resources r
      where r.id = lesson_slides.resource_id and private.is_class_member(r.class_id)
    )
  );
