-- Lets a teacher mark one lesson resource in a class as the active live session and
-- annotate or comment directly on a student's slide while reviewing live progress.

alter table lesson_resources
  add column if not exists is_live_session boolean not null default false;

create index if not exists lesson_resources_class_live_idx
  on lesson_resources (class_id, is_live_session);

alter table slide_submissions
  add column if not exists teacher_annotations jsonb not null default '[]'::jsonb,
  add column if not exists teacher_comment text;

create or replace function public.set_live_lesson_resource(target_resource_id uuid, make_live boolean)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_class_id uuid;
begin
  select class_id into target_class_id
  from lesson_resources
  where id = target_resource_id;

  if target_class_id is null then
    raise exception 'Lesson resource not found';
  end if;

  if not private.is_class_teacher(target_class_id) then
    raise exception 'Only the class teacher can change the live lesson';
  end if;

  if make_live then
    update lesson_resources
    set is_live_session = false
    where class_id = target_class_id;
  end if;

  update lesson_resources
  set is_live_session = make_live,
      updated_at = now()
  where id = target_resource_id;
end;
$$;

revoke execute on function public.set_live_lesson_resource(uuid, boolean) from public;
grant execute on function public.set_live_lesson_resource(uuid, boolean) to authenticated;

create or replace function public.upsert_teacher_slide_overlay(
  target_slide_id uuid,
  target_student_id uuid,
  next_teacher_annotations jsonb default null,
  next_teacher_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_class_id uuid;
begin
  select r.class_id into target_class_id
  from lesson_slides s
  join lesson_resources r on r.id = s.resource_id
  where s.id = target_slide_id;

  if target_class_id is null then
    raise exception 'Slide not found';
  end if;

  if not private.is_class_teacher(target_class_id) then
    raise exception 'Only the class teacher can annotate student work';
  end if;

  insert into slide_submissions (
    slide_id,
    student_id,
    teacher_annotations,
    teacher_comment,
    updated_at
  )
  values (
    target_slide_id,
    target_student_id,
    coalesce(next_teacher_annotations, '[]'::jsonb),
    next_teacher_comment,
    now()
  )
  on conflict (slide_id, student_id)
  do update set
    teacher_annotations = coalesce(next_teacher_annotations, slide_submissions.teacher_annotations),
    teacher_comment = coalesce(next_teacher_comment, slide_submissions.teacher_comment),
    updated_at = now();
end;
$$;

revoke execute on function public.upsert_teacher_slide_overlay(uuid, uuid, jsonb, text) from public;
grant execute on function public.upsert_teacher_slide_overlay(uuid, uuid, jsonb, text) to authenticated;