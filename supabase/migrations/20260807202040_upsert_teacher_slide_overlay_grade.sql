-- Lets a teacher set a manual grade/feedback for a student's slide directly from the live
-- monitor's TeacherReviewModal, reusing the same upsert-even-if-no-submission-row-yet behavior
-- already established for teacher_annotations/teacher_comment in this function.
create or replace function public.upsert_teacher_slide_overlay(
  target_slide_id uuid,
  target_student_id uuid,
  next_teacher_annotations jsonb default null,
  next_teacher_comment text default null,
  next_grade numeric default null,
  next_feedback text default null
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
    grade,
    feedback,
    updated_at
  )
  values (
    target_slide_id,
    target_student_id,
    coalesce(next_teacher_annotations, '[]'::jsonb),
    next_teacher_comment,
    next_grade,
    next_feedback,
    now()
  )
  on conflict (slide_id, student_id)
  do update set
    teacher_annotations = coalesce(next_teacher_annotations, slide_submissions.teacher_annotations),
    teacher_comment = coalesce(next_teacher_comment, slide_submissions.teacher_comment),
    grade = coalesce(next_grade, slide_submissions.grade),
    feedback = coalesce(next_feedback, slide_submissions.feedback),
    updated_at = now();
end;
$$;

revoke execute on function public.upsert_teacher_slide_overlay(uuid, uuid, jsonb, text, numeric, text) from public;
grant execute on function public.upsert_teacher_slide_overlay(uuid, uuid, jsonb, text, numeric, text) to authenticated;
