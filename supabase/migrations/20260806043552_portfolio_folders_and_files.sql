-- Portfolio: teacher-created folders (e.g. "Project", "Copybook Work") that students upload
-- work into. A folder's name/description is teacher-owned; each student's uploaded files are
-- their own -- they see and manage only their own files within a folder, while the teacher
-- can see every student's files there (to actually review submissions).

create table portfolio_folders (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  name text not null,
  description text,
  position int not null default 0,
  created_by uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_folders_class_idx on portfolio_folders (class_id);

create table portfolio_files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references portfolio_folders(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);
create index portfolio_files_folder_idx on portfolio_files (folder_id);
create index portfolio_files_student_idx on portfolio_files (student_id);

alter table portfolio_folders enable row level security;
alter table portfolio_files enable row level security;

create policy "portfolio_folders_teacher_all" on portfolio_folders for all
  using (private.is_class_teacher(class_id))
  with check (private.is_class_teacher(class_id));

create policy "portfolio_folders_student_read" on portfolio_folders for select
  using (private.is_class_member(class_id));

create policy "portfolio_files_teacher_select" on portfolio_files for select
  using (
    exists (
      select 1 from portfolio_folders f
      where f.id = portfolio_files.folder_id and private.is_class_teacher(f.class_id)
    )
  );

create policy "portfolio_files_teacher_delete" on portfolio_files for delete
  using (
    exists (
      select 1 from portfolio_folders f
      where f.id = portfolio_files.folder_id and private.is_class_teacher(f.class_id)
    )
  );

create policy "portfolio_files_student_select" on portfolio_files for select
  using (
    student_id = auth.uid()
    and exists (
      select 1 from portfolio_folders f
      where f.id = portfolio_files.folder_id and private.is_class_member(f.class_id)
    )
  );

create policy "portfolio_files_student_insert" on portfolio_files for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from portfolio_folders f
      where f.id = portfolio_files.folder_id and private.is_class_member(f.class_id)
    )
  );

create policy "portfolio_files_student_delete" on portfolio_files for delete
  using (student_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('portfolio-files', 'portfolio-files', false)
on conflict (id) do nothing;

-- Object paths are "{classId}/{folderId}/{studentId}/{filename}" -- folder segment 1 is the
-- class, segment 3 is the uploading student, mirroring the lesson-files bucket's pattern.
create policy "portfolio_files_storage_teacher_all" on storage.objects for all
  using (
    bucket_id = 'portfolio-files'
    and private.is_class_teacher(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'portfolio-files'
    and private.is_class_teacher(((storage.foldername(name))[1])::uuid)
  );

create policy "portfolio_files_storage_student_own" on storage.objects for all
  using (
    bucket_id = 'portfolio-files'
    and private.is_class_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[3])::uuid = auth.uid()
  )
  with check (
    bucket_id = 'portfolio-files'
    and private.is_class_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[3])::uuid = auth.uid()
  );
