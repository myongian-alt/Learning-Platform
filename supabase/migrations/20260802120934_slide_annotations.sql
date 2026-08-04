alter table lesson_slides
  add column if not exists annotations jsonb not null default '[]'::jsonb;;
