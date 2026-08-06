-- Interactive, auto-graded submissions for an attached "custom_mcqs" task (the AI-generated
-- 5-question quiz a teacher attaches via Additional Resources/Tasks). Scoring is computed
-- server-side from the task's own content snapshot -- never trust a client-supplied score,
-- since this feeds the real gradebook.

create table mcq_task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references lesson_attached_tasks(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb, -- { "0": chosenIndex, "1": chosenIndex, ... }
  correct_count int not null default 0,
  total_count int not null default 0,
  score int not null default 0, -- 0-100
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, student_id)
);

create index mcq_task_submissions_task_idx on mcq_task_submissions (task_id);

alter table mcq_task_submissions enable row level security;

create policy "mcq_task_submissions_student_select" on mcq_task_submissions for select
  using (
    student_id = auth.uid()
    and exists (
      select 1 from lesson_attached_tasks t
      join lesson_resources r on r.id = t.resource_id
      where t.id = mcq_task_submissions.task_id and private.is_class_member(r.class_id)
    )
  );

create policy "mcq_task_submissions_student_upsert" on mcq_task_submissions for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from lesson_attached_tasks t
      join lesson_resources r on r.id = t.resource_id
      where t.id = mcq_task_submissions.task_id and private.is_class_member(r.class_id)
    )
  );

create policy "mcq_task_submissions_student_update" on mcq_task_submissions for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "mcq_task_submissions_teacher_select" on mcq_task_submissions for select
  using (
    exists (
      select 1 from lesson_attached_tasks t
      join lesson_resources r on r.id = t.resource_id
      where t.id = mcq_task_submissions.task_id and private.is_class_teacher(r.class_id)
    )
  );

-- Server-side auto-grading: recomputes correct_count/total_count/score from the task's
-- content snapshot on every insert/update, so a student can never write their own score --
-- only their chosen answers, which this trigger then grades independently.
create function private.compute_mcq_task_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mcqs jsonb;
  total int := 0;
  correct int := 0;
  i int;
  given jsonb;
begin
  select content into mcqs from lesson_attached_tasks where id = new.task_id;
  if mcqs is null or jsonb_typeof(mcqs) <> 'array' then
    raise exception 'Attached task has no gradable content';
  end if;

  total := jsonb_array_length(mcqs);
  for i in 0..total - 1 loop
    given := new.answers -> i::text;
    if given is not null and (given)::int = (mcqs -> i ->> 'correctIndex')::int then
      correct := correct + 1;
    end if;
  end loop;

  new.total_count := total;
  new.correct_count := correct;
  new.score := case when total > 0 then round((correct::numeric / total) * 100) else 0 end;
  new.submitted_at := coalesce(new.submitted_at, now());
  new.updated_at := now();
  return new;
end;
$$;

create trigger mcq_task_submissions_compute_score
before insert or update on mcq_task_submissions
for each row execute function private.compute_mcq_task_score();
