-- Adds structured metadata to `classes` so the "Create Your Class" wizard can
-- capture term/grade/section/subject as distinct fields instead of encoding
-- them into the free-text `name` column. All nullable + additive: existing
-- rows and the plain-name creation flow (useTeacherClasses.createClass)
-- keep working unchanged.

alter table classes
  add column if not exists term text,
  add column if not exists grade text,
  add column if not exists section text,
  add column if not exists subject text;
