create type lesson_task_kind as enum ('quiz', 'assignment', 'project');

create table lesson_attached_tasks (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references lesson_resources(id) on delete cascade,
  kind lesson_task_kind not null,
  position int not null,
  created_by uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (resource_id, position)
);

create index lesson_attached_tasks_resource_idx on lesson_attached_tasks (resource_id, position);

alter table lesson_attached_tasks enable row level security;

create policy "lesson_attached_tasks_teacher_all" on lesson_attached_tasks for all
  using (
    exists (
      select 1 from lesson_resources r
      where r.id = lesson_attached_tasks.resource_id
        and private.is_class_teacher(r.class_id)
    )
  )
  with check (
    exists (
      select 1 from lesson_resources r
      where r.id = lesson_attached_tasks.resource_id
        and private.is_class_teacher(r.class_id)
    )
  );

create policy "lesson_attached_tasks_student_read" on lesson_attached_tasks for select
  using (
    exists (
      select 1 from lesson_resources r
      where r.id = lesson_attached_tasks.resource_id
        and private.is_class_member(r.class_id)
    )
  );
