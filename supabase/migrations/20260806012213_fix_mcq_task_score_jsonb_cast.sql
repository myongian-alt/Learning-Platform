-- The original function tried to cast a jsonb value directly to int, which Postgres
-- rejects at runtime ("cannot cast type jsonb to integer"). Extract as text via ->> first.
create or replace function private.compute_mcq_task_score()
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
  given text;
begin
  select content into mcqs from lesson_attached_tasks where id = new.task_id;
  if mcqs is null or jsonb_typeof(mcqs) <> 'array' then
    raise exception 'Attached task has no gradable content';
  end if;

  total := jsonb_array_length(mcqs);
  for i in 0..total - 1 loop
    given := new.answers ->> i::text;
    if given is not null and given::int = (mcqs -> i ->> 'correctIndex')::int then
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
