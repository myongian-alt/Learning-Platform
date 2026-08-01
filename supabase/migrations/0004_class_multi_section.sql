-- A class can now span multiple sections (e.g. a teacher's Grade 8 Math
-- class covering sections B-G), up to 6 chosen in the "Create Your Class"
-- wizard. Widen `section` from a single value to an array; existing single
-- values are preserved as one-element arrays.

alter table classes
  alter column section type text[] using case when section is null then null else array[section] end;
