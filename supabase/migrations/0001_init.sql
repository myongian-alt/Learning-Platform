-- Penbook initial schema
-- Maps the product feature set onto Postgres tables with RLS.
-- Run via `supabase db push` (CLI) or the Supabase MCP `apply_migration` tool.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- People & orgs
-- ---------------------------------------------------------------------------

create type user_role as enum ('teacher', 'student', 'admin');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'student',
  full_name text not null,
  avatar_url text,
  organization_id uuid references organizations (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Classes & rosters
-- ---------------------------------------------------------------------------

create table classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id) on delete set null,
  teacher_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table class_members (
  class_id uuid not null references classes (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table co_teachers (
  class_id uuid not null references classes (id) on delete cascade,
  teacher_id uuid not null references profiles (id) on delete cascade,
  primary key (class_id, teacher_id)
);

-- ---------------------------------------------------------------------------
-- Assignments = an interactive lesson/deck. Pages = slides/canvases within it.
-- ---------------------------------------------------------------------------

create type delivery_mode as enum ('teacher_paced', 'student_paced', 'front_of_class');
create type assignment_status as enum ('draft', 'published', 'archived');
create type page_source_type as enum ('blank_canvas', 'pdf', 'image', 'slide', 'video', 'question', 'link');

create table assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  created_by uuid not null references profiles (id) on delete cascade,
  title text not null,
  description text,
  delivery_mode delivery_mode not null default 'student_paced',
  is_timed boolean not null default false,
  time_limit_seconds integer,
  available_from timestamptz,
  due_at timestamptz,
  standards text[] not null default '{}',
  status assignment_status not null default 'draft',
  current_page_id uuid, -- set when delivery_mode = teacher_paced, drives "bring whole class to this slide"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table assignment_pages (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments (id) on delete cascade,
  position integer not null,
  title text,
  source_type page_source_type not null default 'blank_canvas',
  source_url text,
  created_at timestamptz not null default now(),
  unique (assignment_id, position)
);

alter table assignments
  add constraint assignments_current_page_fk
  foreign key (current_page_id) references assignment_pages (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Questions embedded on a page (mc, draw, drag & drop, etc.)
-- ---------------------------------------------------------------------------

create type question_type as enum (
  'multiple_choice', 'true_false', 'short_answer', 'fill_blank', 'open_ended',
  'draw', 'audio_response', 'video_response', 'drag_drop', 'matching',
  'graphing', 'hotspot', 'labeling', 'reorder', 'poll'
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references assignment_pages (id) on delete cascade,
  position integer not null,
  type question_type not null,
  prompt text not null,
  options jsonb not null default '{}',       -- choices, drag/drop pairs, matching pairs, etc.
  correct_answer jsonb,                       -- null for ungraded/open-ended types
  points numeric not null default 1,
  created_at timestamptz not null default now(),
  unique (page_id, position)
);

-- ---------------------------------------------------------------------------
-- Student work: submissions (one per student per assignment) and responses
-- (one per question) plus freehand canvas strokes for annotation/drawing.
-- ---------------------------------------------------------------------------

create type submission_status as enum ('not_started', 'in_progress', 'submitted', 'graded');

create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  status submission_status not null default 'not_started',
  started_at timestamptz,
  submitted_at timestamptz,
  score numeric,
  teacher_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table responses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  response_data jsonb not null default '{}',
  is_correct boolean,
  auto_score numeric,
  time_spent_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

create type stroke_author_role as enum ('student', 'teacher');

create table canvas_strokes (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references assignment_pages (id) on delete cascade,
  submission_id uuid references submissions (id) on delete cascade, -- null for teacher-only master annotations
  author_id uuid not null references profiles (id) on delete cascade,
  author_role stroke_author_role not null,
  tool text not null,           -- pen | highlighter | eraser | text | sticker | pointer
  color text,
  stroke_width numeric,
  points jsonb not null,        -- [{x,y,pressure?}, ...] in canvas space
  created_at timestamptz not null default now()
);

create index canvas_strokes_page_idx on canvas_strokes (page_id, submission_id);

-- ---------------------------------------------------------------------------
-- Live-session signals: raise hand / help requests
-- ---------------------------------------------------------------------------

create type help_request_status as enum ('open', 'acknowledged', 'resolved');

create table help_requests (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  page_id uuid references assignment_pages (id) on delete set null,
  is_anonymous boolean not null default false,
  status help_request_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Content library & standards (search/import/AI-generated content lives here)
-- ---------------------------------------------------------------------------

create table standards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  subject text
);

create type library_item_type as enum ('quiz', 'lesson', 'activity', 'video');

create table library_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles (id) on delete set null,
  organization_id uuid references organizations (id) on delete set null,
  type library_item_type not null,
  title text not null,
  description text,
  is_public boolean not null default false,
  standards text[] not null default '{}',
  content jsonb not null default '{}', -- serialized pages/questions, cloned into an assignment on import
  embedding vector(1536),               -- pgvector, for semantic/adaptive search (requires `vector` extension)
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Gamification
-- ---------------------------------------------------------------------------

create table leaderboard_entries (
  assignment_id uuid not null references assignments (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  points integer not null default 0,
  streak integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

-- ---------------------------------------------------------------------------
-- LMS sync (Google Classroom, Canvas, Schoology, Clever, ...)
-- ---------------------------------------------------------------------------

create type lms_provider as enum ('google_classroom', 'canvas', 'schoology', 'clever');

create table lms_connections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  provider lms_provider not null,
  external_id text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table classes enable row level security;
alter table class_members enable row level security;
alter table co_teachers enable row level security;
alter table assignments enable row level security;
alter table assignment_pages enable row level security;
alter table questions enable row level security;
alter table submissions enable row level security;
alter table responses enable row level security;
alter table canvas_strokes enable row level security;
alter table help_requests enable row level security;
alter table standards enable row level security;
alter table library_items enable row level security;
alter table leaderboard_entries enable row level security;
alter table lms_connections enable row level security;

-- Helper functions (security definer so they can read `classes`/`class_members`
-- without recursing through the RLS policies that call them).

create function is_class_teacher(target_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from classes c
    where c.id = target_class_id
      and (c.teacher_id = auth.uid()
           or exists (select 1 from co_teachers ct where ct.class_id = c.id and ct.teacher_id = auth.uid()))
  );
$$;

create function is_class_member(target_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from class_members cm
    where cm.class_id = target_class_id and cm.student_id = auth.uid()
  );
$$;

create function assignment_class_id(target_assignment_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select class_id from assignments where id = target_assignment_id;
$$;

create function page_assignment_id(target_page_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select assignment_id from assignment_pages where id = target_page_id;
$$;

-- profiles: everyone can read profiles of people who share a class with them;
-- a user can always read/update their own profile.
create policy "profiles_self" on profiles for select using (id = auth.uid());
create policy "profiles_self_update" on profiles for update using (id = auth.uid());
create policy "profiles_insert_self" on profiles for insert with check (id = auth.uid());
create policy "profiles_classmates_read" on profiles for select using (
  exists (
    select 1 from class_members me
    join class_members them on them.class_id = me.class_id
    where me.student_id = auth.uid() and them.student_id = profiles.id
  )
  or exists (
    select 1 from classes c
    where is_class_teacher(c.id) and (c.teacher_id = profiles.id or is_class_member(c.id))
  )
);

-- classes: teachers manage their own; students/co-teachers can read.
create policy "classes_teacher_all" on classes for all using (is_class_teacher(id)) with check (teacher_id = auth.uid());
create policy "classes_member_read" on classes for select using (is_class_member(id));

create policy "class_members_teacher_all" on class_members for all using (is_class_teacher(class_id));
create policy "class_members_self_read" on class_members for select using (student_id = auth.uid());
create policy "class_members_self_join" on class_members for insert with check (student_id = auth.uid());

create policy "co_teachers_all" on co_teachers for all using (is_class_teacher(class_id));

-- assignments/pages/questions: teacher of the class has full control; students
-- can only read published assignments for classes they belong to.
create policy "assignments_teacher_all" on assignments for all using (is_class_teacher(class_id));
create policy "assignments_student_read" on assignments for select using (
  status = 'published' and is_class_member(class_id)
);

create policy "pages_teacher_all" on assignment_pages for all using (is_class_teacher(assignment_class_id(assignment_id)));
create policy "pages_student_read" on assignment_pages for select using (is_class_member(assignment_class_id(assignment_id)));

create policy "questions_teacher_all" on questions for all using (is_class_teacher(assignment_class_id(page_assignment_id(page_id))));
create policy "questions_student_read" on questions for select using (is_class_member(assignment_class_id(page_assignment_id(page_id))));

-- submissions/responses: student owns their own; teacher of the class can
-- read/grade all submissions for their assignments.
create policy "submissions_student_own" on submissions for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "submissions_teacher_read" on submissions for select using (is_class_teacher(assignment_class_id(assignment_id)));
create policy "submissions_teacher_grade" on submissions for update using (is_class_teacher(assignment_class_id(assignment_id)));

create policy "responses_student_own" on responses for all using (
  exists (select 1 from submissions s where s.id = submission_id and s.student_id = auth.uid())
) with check (
  exists (select 1 from submissions s where s.id = submission_id and s.student_id = auth.uid())
);
create policy "responses_teacher_read" on responses for select using (
  exists (
    select 1 from submissions s
    where s.id = submission_id and is_class_teacher(assignment_class_id(s.assignment_id))
  )
);

-- canvas strokes: the authoring student can write their own strokes; the
-- teacher of the class can write annotation strokes on any student's page and
-- read everything (this is the "see all students' live work" dashboard).
create policy "strokes_student_own" on canvas_strokes for all using (
  author_role = 'student' and author_id = auth.uid()
) with check (
  author_role = 'student' and author_id = auth.uid()
);
create policy "strokes_teacher_all" on canvas_strokes for all using (
  is_class_teacher(assignment_class_id(page_assignment_id(page_id)))
) with check (
  author_role = 'teacher' and author_id = auth.uid()
  and is_class_teacher(assignment_class_id(page_assignment_id(page_id)))
);
create policy "strokes_classmate_read" on canvas_strokes for select using (
  is_class_member(assignment_class_id(page_assignment_id(page_id)))
);

-- help requests: student manages their own; teacher of the class sees/resolves all.
create policy "help_requests_student_own" on help_requests for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "help_requests_teacher_all" on help_requests for all using (is_class_teacher(assignment_class_id(assignment_id)));

-- standards: readable by everyone signed in, writable by admins only (handled at app layer).
create policy "standards_read_all" on standards for select using (auth.uid() is not null);

-- library items: owner has full control; anything public is readable by everyone signed in.
create policy "library_items_owner_all" on library_items for all using (owner_id = auth.uid());
create policy "library_items_public_read" on library_items for select using (is_public and auth.uid() is not null);

-- leaderboard: readable by class members/teacher, written by the app via service role
-- (auto-grading edge function) or by the student for their own row.
create policy "leaderboard_student_own" on leaderboard_entries for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "leaderboard_teacher_read" on leaderboard_entries for select using (is_class_teacher(assignment_class_id(assignment_id)));

-- lms connections: teacher-managed only.
create policy "lms_connections_teacher_all" on lms_connections for all using (is_class_teacher(class_id));
