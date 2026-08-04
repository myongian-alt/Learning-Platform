alter table lesson_slides
  add column if not exists objects jsonb not null default '[]'::jsonb;

alter table slide_submissions
  add column if not exists objects jsonb not null default '[]'::jsonb;
;
