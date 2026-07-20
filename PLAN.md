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
