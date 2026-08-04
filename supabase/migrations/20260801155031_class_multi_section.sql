alter table classes
  alter column section type text[] using case when section is null then null else array[section] end;;
