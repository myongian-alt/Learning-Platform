-- Postgres Changes (not just ephemeral Presence) is now needed for two live-sync features:
-- a slide's timer_command reaching every viewer instantly, and a student's own slide_submissions
-- row (grade/feedback) reaching their open slide view the moment a teacher grades it. Realtime
-- authorization checks each table's own SELECT RLS (already correct for both -- see
-- lesson_slides_student_read / slide_submissions_student_select), so no policy changes needed,
-- just opting these two tables into the publication.
alter publication supabase_realtime add table lesson_slides, slide_submissions;
