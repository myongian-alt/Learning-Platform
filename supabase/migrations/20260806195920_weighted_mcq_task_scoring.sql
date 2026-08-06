-- Replaces equal-weight scoring (round(correct/total*100)) with per-question point weights.
-- A quiz's content is a frozen snapshot at attach time (see lesson_attached_tasks_content_snapshot),
-- so by the time a question reaches this trigger its `points` is either a concrete resolved value
-- (teacher-reviewed at attach time, see TaskPickerOverlay) or absent on any quiz attached before
-- this change existed -- the per-question coalesce to an even share (100/total_count) keeps those
-- already-live quizzes scoring exactly as before, no backfill needed.
create or replace function private.compute_mcq_task_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mcqs jsonb;
  total_count int := 0;
  correct int := 0;
  total_points numeric := 0;
  earned_points numeric := 0;
  i int;
  given text;
  q_points numeric;
begin
  select content into mcqs from lesson_attached_tasks where id = new.task_id;
  if mcqs is null or jsonb_typeof(mcqs) <> 'array' then
    raise exception 'Attached task has no gradable content';
  end if;

  total_count := jsonb_array_length(mcqs);
  for i in 0..total_count - 1 loop
    q_points := coalesce((mcqs -> i ->> 'points')::numeric, 100.0 / total_count);
    total_points := total_points + q_points;
    given := new.answers ->> i::text;
    if given is not null and given::int = (mcqs -> i ->> 'correctIndex')::int then
      correct := correct + 1;
      earned_points := earned_points + q_points;
    end if;
  end loop;

  new.total_count := total_count;
  new.correct_count := correct;
  new.score := case when total_points > 0 then round((earned_points / total_points) * 100) else 0 end;
  new.submitted_at := coalesce(new.submitted_at, now());
  new.updated_at := now();
  return new;
end;
$$;
