-- Per-student "turn in" workspace for a slide: each student annotates their own copy
-- (separate from the teacher's authoring-layer `lesson_slides.annotations`) and can mark
-- it submitted. Scoped to lesson_slides rather than routed through the existing
-- assignments/assignment_pages + canvas_strokes pipeline (which already does student
-- draw+submit for a different surface) — deliberate short-term duplication, to keep this
-- feature self-contained under Lessons/slides; reconciling the two is tracked in ROADMAP.md.

alter table lesson_slides
  add column if not exists submissions_enabled boolean not null default false;

create table slide_submissions (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references lesson_slides(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  annotations jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (slide_id, student_id)
);

create index slide_submissions_slide_idx on slide_submissions (slide_id);

alter table slide_submissions enable row level security;

-- Teachers: read-only across their classes — this powers "who has completed this slide",
-- not editing of student work.
create policy "slide_submissions_teacher_select" on slide_submissions for select
  using (
    exists (
      select 1 from lesson_slides s
      join lesson_resources r on r.id = s.resource_id
      where s.id = slide_submissions.slide_id and private.is_class_teacher(r.class_id)
    )
  );

-- Students: can always read their own past work, even after a teacher later disables
-- submissions for the slide — the toggle gates new writes, not visibility of what a
-- student already turned in.
create policy "slide_submissions_student_select" on slide_submissions for select
  using (
    student_id = auth.uid()
    and exists (
      select 1 from lesson_slides s
      join lesson_resources r on r.id = s.resource_id
      where s.id = slide_submissions.slide_id and private.is_class_member(r.class_id)
    )
  );

create policy "slide_submissions_student_insert" on slide_submissions for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from lesson_slides s
      join lesson_resources r on r.id = s.resource_id
      where s.id = slide_submissions.slide_id
        and s.submissions_enabled
        and private.is_class_member(r.class_id)
    )
  );

create policy "slide_submissions_student_update" on slide_submissions for update
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from lesson_slides s
      join lesson_resources r on r.id = s.resource_id
      where s.id = slide_submissions.slide_id
        and s.submissions_enabled
        and private.is_class_member(r.class_id)
    )
  );
;
