create type lesson_file_type as enum ('pdf', 'pptx', 'docx', 'image', 'video', 'link');

create table lesson_resources (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  week_number int not null,
  lesson_number int not null default 1,
  title text not null,
  file_type lesson_file_type not null,
  storage_path text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lesson_resources_class_week_idx on lesson_resources (class_id, week_number);

alter table lesson_resources enable row level security;

create policy "lesson_resources_teacher_all" on lesson_resources for all
  using (private.is_class_teacher(class_id))
  with check (private.is_class_teacher(class_id));

create policy "lesson_resources_student_read" on lesson_resources for select
  using (private.is_class_member(class_id));

alter table assignments add column if not exists week_number int;

insert into storage.buckets (id, name, public)
values ('lesson-files', 'lesson-files', false)
on conflict (id) do nothing;

create policy "lesson_files_teacher_all" on storage.objects for all
  using (
    bucket_id = 'lesson-files'
    and private.is_class_teacher(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'lesson-files'
    and private.is_class_teacher(((storage.foldername(name))[1])::uuid)
  );

create policy "lesson_files_student_read" on storage.objects for select
  using (
    bucket_id = 'lesson-files'
    and private.is_class_member(((storage.foldername(name))[1])::uuid)
  );;
