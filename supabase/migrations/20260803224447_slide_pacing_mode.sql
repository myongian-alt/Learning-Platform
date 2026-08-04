-- Lets a teacher mark individual slides as "teacher-paced" (force-locks a student's
-- navigation to the teacher's live position while presenting) or "student-paced" (today's
-- unrestricted free navigation). Default `student_paced` preserves every existing slide's
-- current behavior — nothing locks for anyone until a teacher explicitly opts a slide in.
create type slide_pacing_mode as enum ('teacher_paced', 'student_paced');

alter table lesson_slides
  add column if not exists pacing_mode slide_pacing_mode not null default 'student_paced';
;
