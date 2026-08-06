-- Teacher-defined extra gradebook columns (e.g. "Class Participation"), manually scored per
-- student, plus a persisted display order covering BOTH these and the auto-derived
-- slide/quiz columns -- so a teacher can freely reorder the whole gradebook, not just their
-- own additions.

create table gradebook_custom_columns (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  label text not null,
  created_by uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gradebook_custom_columns_class_idx on gradebook_custom_columns (class_id);

create table gradebook_custom_scores (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references gradebook_custom_columns(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  score numeric,
  updated_at timestamptz not null default now(),
  unique (column_id, student_id)
);

-- One row per class: an ordered array of column keys (e.g. "slide:<uuid>", "quiz:<uuid>",
-- "custom:<uuid>"). Any column not yet present in this array (a brand-new slide graded
-- today, say) is appended at the end by the app in its natural default order -- this table
-- only needs to store explicit overrides once a teacher actually reorders something.
create table gradebook_layouts (
  class_id uuid primary key references classes(id) on delete cascade,
  column_order jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table gradebook_custom_columns enable row level security;
alter table gradebook_custom_scores enable row level security;
alter table gradebook_layouts enable row level security;

create policy "gradebook_custom_columns_teacher_all" on gradebook_custom_columns for all
  using (private.is_class_teacher(class_id))
  with check (private.is_class_teacher(class_id));

create policy "gradebook_custom_scores_teacher_all" on gradebook_custom_scores for all
  using (
    exists (
      select 1 from gradebook_custom_columns c
      where c.id = gradebook_custom_scores.column_id and private.is_class_teacher(c.class_id)
    )
  )
  with check (
    exists (
      select 1 from gradebook_custom_columns c
      where c.id = gradebook_custom_scores.column_id and private.is_class_teacher(c.class_id)
    )
  );

create policy "gradebook_layouts_teacher_all" on gradebook_layouts for all
  using (private.is_class_teacher(class_id))
  with check (private.is_class_teacher(class_id));
