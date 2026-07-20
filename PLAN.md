# classOS — Standing Plan

The prototypes are the bar: **prototype-v4's UI + classOS-lessons' content + classOS-editor's
authoring flow**, with a real database underneath. Any change that makes the app feel *thinner*
than the prototypes is a regression, even if the backend is "more real".

## Done
- [x] All 15 Unit 2 lessons extracted from `classOS-lessons.html` → `prisma/curriculum.seed.json`
      (checked into the repo — seeding no longer depends on any script).
- [x] Prototype-v4 design system ported (`app/globals.css`): Fraunces/Public Sans/JetBrains Mono,
      paper/ink palette, topbar, sidebar with status dots, readiness bar, tagged panels, console,
      lettered quiz options, tutor bubbles, SEB-style clean-quiz overlay, teacher KPIs.
- [x] Editor rebuilt on classOS-editor's design + **drag-to-reorder blocks**, per-row term/check/quiz
      editors (no raw JSON), duplicate/delete lesson, add chapter/lesson, export/import.
- [x] AI truncation root-caused: thinking models (gemini-3.5-flash) spend hidden reasoning tokens
      inside `max_tokens`. Budgets raised (tutor/grade 3000, generate 8000); parse failures now
      show the raw model reply instead of silently falling back.

- [x] **Class-code auth** — `Class` model with join codes; staff email+password (scrypt),
      HMAC-signed session cookies; students join via code + name at `/join`; teacher page
      creates classes and shows codes; dev role-switcher deleted; all pages/APIs gated.
- [x] **Java runner replaced** — public Piston went whitelist-only 2026-02-15 (this was the
      "runner error"); default is now Compiler Explorer's free API (verified end-to-end,
      wrapper class made non-public for arbitrary filenames); `PISTON_URL` still supported.
- [x] **WYSIWYG editor v2** — edit-while-previewing (contentEditable in student-identical
      markup, floating B/I/code bar, hover block tools, drag ⠿, "+" insert between blocks),
      DRAFT autosave + Publish/Discard, LessonVersion history with restore-to-draft.
- [x] **Grading modes** — rule-based (no AI call) vs AI coaching, v4's toggle restored;
      verdict is always the output test. Clean quiz moved to the bottom of the lesson.
- [x] **Side dock** — scratchpad + tutor in an edge-rail dock (persistent code via
      localStorage; tutor sees scratchpad code); removed from the page scroll flow.
- [x] **Teacher drill-down** — per-student page (`/teacher/student/[id]`) with every attempt
      expandable to missed questions + submitted code; quiz attempts now log per-question
      detail; dashboard shows lesson-difficulty table (hardest first) instead of raw feed.

- [x] **Security hardening (pre-deploy audit)** — summative bank/grading fully server-side
      (`/api/quiz`; answer key never ships; `/api/progress` refuses SUMMATIVE); stored-XSS fix
      (teacher pages render student data as plain text; AI quiz output sanitized); random
      seeded staff passwords + `/account` password change; production guard on weak
      ENCRYPTION_KEY; rate limits (login/join/run/AI) + class-size cap + student daily AI cap;
      security headers.

- [x] **DEPLOYED** — live on Vercel + Neon Postgres. Setup verified end-to-end (15 lessons,
      auth, messaging all confirmed against Neon). `postinstall: prisma generate` for Vercel.
- [x] **Round 2 UX/features (2026-07-20):** quiz `\n` renders as lines; readiness = avg of last
      5 attempts (reaches 100%); sidebar scrolls independently; scratchpad + tutor are now
      independent dock/float windows (`components/student/`, drag title to float, ⇥/⧉/✕
      controls, resize, persisted); highlight lesson text → "Ask AI" routes to tutor; teacher
      class powers (rename/delete/regen code/kick+rename students — `components/teacher/`,
      `/api/classes` action-based w/ ownership); student↔staff messaging + inbox + unread
      badge (`Message` model, `lib/messaging.ts`, `/api/messages`, `components/messaging/`).
- [x] **ARCHITECTURE.md** — the code map (edit-one-folder-per-feature); components reorganized
      into student/ teacher/ messaging/ subfolders.

- [x] **Round 3 (2026-07-20):** floating-window drag bug fixed (pointer-buttons check);
      highlight-to-ask has an optional prompt + opt-in "Ask teacher" (pref per teacher,
      questions arrive in inbox with a lesson link); scratchpad v2 (code|output side-by-side,
      stdin behind a toggle, built-in AI strip, ⌘Enter run); clean quiz opens as a full-screen
      tab (/exam/[code]); lesson objectives (shown to students, scopes the AI, editable,
      drafted+versioned); message edit/delete.

- [x] **Unified question + test system (2026-07-20, DONE):** typed questions
      (`lib/curriculum/questions.ts`: info/mcq/tf/short/long/code — DBQ = info + following Qs);
      server grader (`lib/grading.ts`, auto for mcq/tf/short/code, long → manual/AI);
      `Test`+`TestSubmission` models; shared `QuestionView`/`QuestionEditor`; test builder
      (`/tests/[id]/edit`, class assign, time limit, close time, publish, AI-generate typed
      questions); full-screen taker (`/exam/test/[id]`, countdown, auto-submit); teacher
      results+grading (`/teacher/test/[id]`: table, per-question marks, AI-suggest for essays,
      teacher override, class average). Legacy lesson quizBank auto-normalizes to mcq.
- [x] Inline message edit + custom delete confirm (no more browser popups).
- [x] **WORKING-SOLO.md** — guide for the owner to build alone with free tools (AI Studio loop,
      always `npm run build` before push, Vercel rollback, good first projects).

- [x] **Test system polish (2026-07-20):** drag + insert-between questions in builder;
      results-release control (`Test.resultsReleased`, teacher toggles on grader page);
      model answers shown while grading; AI-grade for CODE questions too (not just essays),
      teacher overrides; student result view (`/tests/[id]/result`) with per-Q feedback,
      gated on release. Confirmed: save-without-publish already worked (DRAFT state).

## BACKLOG — pick one at a time (owner prefers incremental; I over-reach on big-bangs)
Ordered by my recommendation, but owner chooses:
- [x] **Dashboard declutter (done)** — student detail page now groups activity by lesson,
      collapses code-runs behind a count, and has a Tests section. Also fixed 4 test bugs:
      AI-grade JSON truncation, pre-release grade hiding (+ name the ungraded remainder),
      AI-gen coding questions + real code editor for starter, quoted-passage highlight in DMs.
- [x] **Gradebook (done)** — `/gradebook` role-aware: teacher gets a class grid (students ×
      tests + mastered count); student sees their released test scores + mastered lessons.
- [x] **Account management (done)** — `/account`: edit name + avatar (128px data URL, `User.avatar`);
      admin `StaffManager` adds/removes teachers, resets passwords. `/api/account`, `/api/admin/users`.
- [x] **Dark mode (done)** — `ThemeToggle` in nav, `data-theme` on <html> + no-flash inline script;
      dark palette overrides in globals.css. May need contrast tweaks by eye (owner can iterate).
      STILL DEFERRED (own turns): prompt-persona editor + AI budget dashboard (part of #4 originally).

1. **Quizzes-inside-lessons** — let a lesson embed a Test (replace the legacy quizBank UI with
   the typed question system). Biggest structural item; unifies the two quiz paths.
3. **Gradebook** — collect Test finalScores + lesson mastery into one grades view per class,
   plus student "my grades".
4. **Account management** — admin adds/edits teachers, everyone edits name + avatar (User.avatar
   field already exists), admin prompt-persona editor (move `lib/llm/prompts.ts` into DB Settings),
   AI budget dashboard.
5. **SEB** — generate .seb config for a test + verify SEB headers before serving /exam.
6. **Small**: dark mode (owner may DIY per WORKING-SOLO.md), window-squeeze-content,
   "ask teacher on highlight" is NOT a bug — needs the teacher's toggle ON (Teacher page).

### earlier design note (superseded — system now built):
One typed model in `lib/curriculum/questions.ts` replacing the MCQ-only bank:
`mcq | tf | short (text answer, tolerant match) | code (run + output check) | essay
(AI-assisted, teacher-confirmed grade) | info (ungraded stimulus: passage/code/image to read,
groups following questions)`. Subject-agnostic on purpose (works for English/history/math).
- One `QuestionView` renderer + one `QuestionEditor` per type; `lib/questions.ts` grades
  everything server-side (code questions run via the runner).
- Legacy `{q,opts,correct,why}` normalizes to `mcq` — no data migration needed.
- AI generation emits the same typed JSON (schema in the prompt).
- **Test builder**: a `Test` entity (name, question list, time limit?, class assignment,
  open/close window) + full-screen taking flow reusing /exam; results feed the same
  Attempt/readiness pipeline. SEB (Safe Exam Browser) integration hooks into /exam:
  generate a .seb config + verify SEB request headers before serving questions.

## Next (in order — polish backlog)
2. **Authoring upgrades** — AI-drafts-a-lesson (topic → blocks + exercise + quiz for review),
   Markdown paste-import. Both land inside the existing editor, not as new pages.
3. **Exercises/quizzes for lessons 2.3–2.9, 2.12–2.15** — author via the editor's new exercise/quiz
   sections (or AI-draft them once #2 lands).
4. CSV export, per-student drawer on the teacher dashboard, versioned lesson snapshots,
   staff password-change form.

## Invariants (do not break)
- `lib/progress.ts` is the only place mastery changes; only a passing SUMMATIVE sets MASTERED.
- Output-comparison is the grading verdict; AI only writes coaching.
- One `<LessonRenderer>` serves both the student reader and the editor preview.
- Keys stay server-side, encrypted at rest, swappable without redeploy.
