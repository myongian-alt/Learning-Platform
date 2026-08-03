# Roadmap: feature spec → implementation status

This maps every feature area from the product brief onto what exists in this
codebase today. Three states:

- ✅ **Working** — real, functional code (may still need polish/tests)
- 🏗️ **Scaffolded** — database schema + types exist, UI is a labeled "coming
  soon" placeholder, or the mechanism is wired but minimal
- 📋 **Planned** — not yet modeled; noted here so the next pass has a target

## Class content: Lessons, slides & activity tagging

This is a second content system, added alongside the original `assignments` /
`assignment_pages` model above — it powers the class-scoped "Lessons" screen
(`src/app/class/[classId].tsx`) rather than the per-assignment canvas flow.
The two aren't reconciled yet (see note at the end of this section).

| Feature                                                        | Status | Notes                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guided class creation (term/grade/multi-section/subject)       | ✅     | `create-class.tsx` wizard → `useCreateClassWizard`. `classes.section` is `text[]` (up to 6). Teacher lands here automatically on first sign-in (`(teacher)/dashboard.tsx` redirects when `classesQuery` is empty, or straight to the class when there's exactly one).                        |
| Week-organized lesson library                                  | ✅     | `lesson_resources` (one row per uploaded file, `week_number` 1–15) + real Supabase Storage upload (`lesson-files` bucket) via `useLessonResources`. Opening a week folder shows an inline upload control and that week's files/slides — see `OpenWeekView`.                                   |
| PDF/image → slide conversion                                   | ✅     | Client-side only (`src/lib/pdf-to-slides.ts`, PDF.js + canvas rendering — needs DOM APIs, so **web only**; native uploads skip conversion). One `lesson_slides` row per rendered page. `conversion_status` (`pending`/`ready`/`failed`) drives a "Retry" affordance for interrupted uploads. |
| Slide viewer                                                    | ✅     | Thumbnail grid (numbered, tag-tinted) → tap opens a full-size viewer with Prev/Next paging, positioned at the tapped slide.                                                                                                                                                                    |
| Rename / delete lesson files                                    | ✅     | Inline rename + confirm-delete on every file card; delete removes both the Storage objects and the DB rows.                                                                                                                                                                                    |
| Activity tagging + per-slide timer                              | ✅     | 9 tags (Title/Objectives, Warm Up, Main Idea, Solved Examples, Guided Practice, Independent Activity, Group Activity, Challenge/Extra Activity, Exit Ticket), each with a color that lightly tints the slide background. Duration (0–20 min) + a real Start/Pause/Reset countdown per slide.  |
| Student-facing lesson experience (LearnFlow redesign)            | ✅     | Full student redesign against the LearnFlow spec: dashboard (stats/streak/badges/live banner, `use-student-dashboard.ts`), week-folder grid with lock/progress (`use-class-week-progress.ts`), week detail split into resources vs. activities (`use-week-activities.ts`), Grades screen (manual grade + feedback + auto-graded breakdown), Progress screen, To-do screen (merges lesson activities, legacy assignments, and recent feedback). See `src/app/(student)/`. |
| Student-facing slide/timer view (live sync)                      | 🏗️     | A teacher's open slide viewer broadcasts over Supabase Realtime Presence (`use-live-class-session.ts`, no new tables) — students see a "LIVE NOW" banner and can toggle "Follow teacher" to sync the current slide index. **Not yet synced**: the per-slide countdown timer itself (`SlideTimer`'s start/pause state is still local-only per viewer) and teacher-drawn annotation strokes appearing live on a student's screen.                                                                            |
| Reconcile with `assignments`/`assignment_pages`                 | 📋     | Two parallel "content" models still exist at the *data* level (assignment pages/canvas vs. lesson resources/slides) — unchanged by the LearnFlow redesign. What did change: the student's top-level nav no longer exposes both as separate tabs — legacy assignment due-items/scores are folded into the new unified To-do/Grades screens (`use-student-todo.ts`, `use-student-grades.ts`), so a student sees one To-do list and one Grades list regardless of which pipeline a given item came from. The underlying two-table-families question (whether lessons become a `source_type` on `assignment_pages`, or assignments start referencing `lesson_resources`) is still open. |
| Quiz / Fill-in-the-blanks (lesson_slides pipeline)               | ✅     | `src/components/lessons/{quiz-view,fill-blanks-view}.tsx` — full-screen, one-at-a-time (quiz) / auto-checked (blanks) presentations of a slide's existing teacher-authored `multiple_choice`/`fill_blank` `SlideObject`s, with new client-side auto-grading (`lib/slide-grading.ts`). **Distinct from** the "Question types" row below, which is a *different*, still-unbuilt system on the `questions`/`assignments` pipeline — don't conflate the two when reconciling. |

## Live classroom visibility & control

| Feature                                                                                   | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| See all students' live work on one dashboard                                              | 🏗️     | [`live/[assignmentId].tsx`](./src/app/live/[assignmentId].tsx) renders a real-time roster grid (online status, raise-hand badges) via Supabase Presence + `postgres_changes`. Actual live canvas _thumbnails_ per student aren't rendered yet — `canvas_strokes` rows are captured and persisted, but the teacher grid doesn't replay them into a mini-preview per tile yet.                                                     |
| Digital raise hand (+ anonymous peer help)                                                | ✅     | `help_requests` table + RLS; student side inserts via `useAssignmentSession().raiseHand`; teacher side subscribes in real time in `useLiveMonitor`. Anonymous peer-help matching isn't built.                                                                                                                                                                                                                                    |
| Direct annotation/feedback on student canvases (pen, highlighter, text, stickers, points) | 🏗️     | `InfiniteCanvas` supports pen/highlighter/eraser as a student tool. Teacher-authoring-onto-student-canvas (the `strokes_teacher_all` RLS policy already allows this) has no UI yet — needs a teacher-side canvas viewer that opens a student's `submission_id` and draws with `author_role: 'teacher'`. Text/stickers/points tools aren't implemented (schema's `tool` column is a free-text field, so adding them is additive). |
| Whole-class pacing vs. independent work                                                   | 🏗️     | `assignments.delivery_mode` + `assignments.current_page_id` model this. No UI yet to push "jump everyone to this page" — would be a Realtime broadcast from the teacher's live screen setting `current_page_id`, which student canvases subscribe to.                                                                                                                                                                            |
| Online/offline status + filtering                                                         | ✅     | `live/[assignmentId].tsx` has All/Online/Needs-help filters over live Presence data.                                                                                                                                                                                                                                                                                                                                             |
| AI helper for stuck students                                                              | 📋     | No edge function yet. Planned: a Supabase Edge Function calling Claude, scoped to the current question/page context, invoked from the student canvas toolbar.                                                                                                                                                                                                                                                                    |

## Question types & assessment

| Feature                                                                                                                                             | Status | Notes                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Question types (MC, T/F, short answer, fill-blank, open-ended, draw, audio/video, drag-drop, matching, graphing, hotspot, labeling, reorder, polls) | 🏗️     | All 15 types exist as the `question_type` enum in the schema (`questions` table, `options`/`correct_answer` as jsonb so each type's shape is flexible). No renderer components yet — this is the single biggest chunk of remaining UI work, one component per type. |
| Delivery modes (teacher-paced, student-paced, timed, untimed)                                                                                       | 🏗️     | Modeled on `assignments` (`delivery_mode`, `is_timed`, `time_limit_seconds`). Timer UI not built.                                                                                                                                                                   |
| Instant auto-grading + explanations                                                                                                                 | 📋     | `responses.is_correct` / `auto_score` columns exist; grading logic (compare `response_data` to `correct_answer` per question type) isn't written yet. Best done in a Postgres function or Edge Function so it can't be bypassed client-side.                        |
| Quick Questions / exit tickets                                                                                                                      | 📋     | Same underlying model as any short assignment with 1 page; needs a "quick create" UI shortcut.                                                                                                                                                                      |
| Real-time response visualization / "How did we do?" / live progress dashboards                                                                      | 📋     | Data model supports it (`responses` + `submissions` are queryable in real time via Supabase Realtime `postgres_changes`); no chart UI yet.                                                                                                                          |
| Reports/exports (by student/question/class, CSV/Excel, LMS sync)                                                                                    | 🏗️     | `(teacher)/reports` is a placeholder screen. CSV export is straightforward once report queries exist (aggregate `responses` → generate CSV client-side or via an Edge Function).                                                                                    |

## Gamification

| Feature                                                        | Status | Notes                                                                                                         |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| Leaderboards, power-ups, avatars, themes                       | 📋     | `leaderboard_entries` table exists (points/streak per student per assignment). No UI, avatars, or themes yet. |
| Team-based competitive modes (race-style)                      | 📋     | Not modeled. Would need a `teams` table + a realtime race-progress view.                                      |
| Redemption questions, adaptive question banks, spaced practice | 📋     | Not modeled. `library_items` + `standards` give a base to build adaptive selection on top of.                 |

## Lesson delivery & content

| Feature                                                                                                           | Status | Notes                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import PDFs/slides/images/video/YouTube                                                                           | 🏗️     | Within `assignment_pages`/`InfiniteCanvas`, still only `blank_canvas` pages render. **Separately**, the newer `lesson_resources`/`lesson_slides` system (see "Class content" section above) *does* have working Storage upload + PDF/image → slide conversion — just not wired into the assignment/canvas flow yet. |
| Embedded interactive elements (polls, Draw It, Collaborate Boards, Drag & Drop, Matching, quiz games, open-ended) | 📋     | Depends on the question-type renderers above.                                                                                                                                                                                                                                                             |
| Rich media (interactive video, VR, 3D, simulations)                                                               | 📋     | Not modeled beyond `source_type: 'video'`.                                                                                                                                                                                                                                                                |
| Three delivery modes (live participation, student-paced, front-of-class)                                          | 🏗️     | Same `delivery_mode` enum as above; front-of-class (project without student devices) has no dedicated "presenter" screen yet.                                                                                                                                                                             |
| Teacher live annotation seen by students in real time                                                             | 🏗️     | RLS already allows teacher strokes on any student submission; needs the teacher canvas viewer (see "Direct annotation" above) plus students subscribing to new `canvas_strokes` rows via Realtime (currently strokes are only inserted, not subscribed-to/streamed back down).                            |
| Pause / discuss / adapt lesson from live data                                                                     | 📋     | Needs the whole-class pacing broadcast mentioned above.                                                                                                                                                                                                                                                   |

## Content library & creation tools

| Feature                                           | Status | Notes                                                                                                                                                                                                                    |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Searchable library of ready-made content          | 🏗️     | `library_items` table with `is_public`, `standards`, and a `vector(1536)` embedding column (pgvector) for semantic search. `(teacher)/library` is a placeholder screen.                                                  |
| Build from scratch / import / mix-and-match       | 🏗️     | `useCreateAssignment` creates a draft assignment + first blank page — the minimal path. No page-reordering or "add page" UI yet.                                                                                         |
| AI-generate quizzes/lessons from a topic/standard | 📋     | Planned as a Supabase Edge Function calling Claude, writing structured output into `library_items.content` (pages/questions), then "import into assignment" clones it into `assignments`/`assignment_pages`/`questions`. |
| Co-teaching, shared folders, district libraries   | 🏗️     | `co_teachers` table + `organizations` give the base. No sharing UI.                                                                                                                                                      |

## Student experience

| Feature                                                     | Status | Notes                                                                                                     |
| ----------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Multiple input methods (draw, type, upload, record, select) | 🏗️     | Draw is implemented (`InfiniteCanvas`). Other input types are per-question-type UI (see above).           |
| Peer collaboration / anonymous peer help                    | 📋     | Not modeled beyond the `is_anonymous` flag on `help_requests`.                                            |
| Student portfolios                                          | 🏗️     | `(student)/portfolio` is a placeholder; data (`submissions`, `responses`) already supports building this. No longer a top-level student tab (folded out in the LearnFlow nav redesign — the route file itself is untouched and still reachable). |
| Accessibility (read-aloud, translations, accommodations)    | 📋     | Not started.                                                                                              |

## Analytics, rosters & LMS

| Feature                                                                    | Status | Notes                                                                                                                                                                                                         |
| -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real-time + post-session analytics, misconceptions, standards alignment    | 📋     | `assignments.standards text[]` exists for alignment tagging; no analytics computation yet.                                                                                                                    |
| Gradebook export + two-way LMS sync (Classroom, Canvas, Schoology, Clever) | 🏗️     | `lms_connections` table models the connection; no OAuth flows or sync jobs implemented.                                                                                                                       |
| Rosters, class management, flexible deadlines                              | ✅     | `classes` + `class_members` + join-code flow are fully working (`(teacher)/classes`, `(student)/home` join-by-code, guided creation wizard with term/grade/multi-section/subject). `assignments.available_from` / `due_at` model flexible deadlines; no UI to set them yet. |
| Student/teacher/admin longitudinal views                                   | 📋     | Depends on analytics above.                                                                                                                                                                                   |

## Platform

| Feature                                                                           | Status | Notes                                                                                                                                                                    |
| --------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Works in-person / hybrid / remote / async                                         | ✅     | Nothing in the architecture assumes co-location; Supabase Realtime + async Postgres reads cover both.                                                                    |
| Device-agnostic (web + native, tablets/phones/laptops)                            | ✅     | Expo Router + React Native Web; NativeWind layouts use responsive max-widths rather than fixed device assumptions.                                                       |
| Differentiation / small groups / whole class / independent / homework in one flow | 🏗️     | `delivery_mode` per assignment is the seam for this; no per-student differentiated content yet (would extend `library_items` "transform existing materials" AI feature). |

## Suggested next slice

If continuing this build, the highest-leverage next steps are probably, in order:

1. Decide how the `lesson_resources`/`lesson_slides` system (Lessons screen) and the
   `assignments`/`assignment_pages` system (canvas/live-monitor) relate at the *data*
   level — the student-facing *nav* no longer exposes them as separate surfaces (see
   "Class content" section), but they're still two independent table families
   underneath. This is the same open question as before, just lower-urgency now that
   the UI-level duplication is gone.
2. Sync the per-slide countdown timer and teacher-drawn annotation strokes over the
   same live-presence channel that already broadcasts "which slide" (`use-live-class-
   session.ts`) — the channel/plumbing exists, only the timer-state and stroke-
   streaming payloads are missing.
3. Question-type renderers on the *other* pipeline (multiple_choice + short_answer +
   draw first — covers most quiz use cases) and its auto-grading function. Note this
   is separate from the quiz/fill-blank UI now built on `lesson_slides` (see "Class
   content" section) — that one auto-grades client-side against `SlideObject`s, not
   against `questions`/`responses`.
4. Teacher-side canvas viewer that opens a specific student's submission and draws
   annotation strokes onto it — this is the other half of "live monitoring."
5. Persisted badges/streak (currently computed on read from `slide_submissions` each
   time, not stored) if a real gamification system beyond the three computed badges
   (Consistent Learner / Quiz Ace / Early Bird) is wanted.

~~Storage-backed uploads (PDF/image) rendered inside a page~~ — done, via the Lessons
screen's `lesson_resources`/`lesson_slides` (not yet inside the assignment canvas, per #1 above).

~~A student-facing view of tagged/timed slides~~ — done (see "Class content" section):
full dashboard, week folders, quiz/blanks, grades, progress, to-do, and a live-presence
banner. What's *not* synced live yet is called out in that section's notes (#2 above).
