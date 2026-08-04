alter table classes
  add column if not exists term text,
  add column if not exists grade text,
  add column if not exists section text,
  add column if not exists subject text;;
