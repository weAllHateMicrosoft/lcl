# classOS — Architecture Map

Read this first when changing anything. It tells you the **one place** to edit for a given
feature, so you never have to read the whole codebase.

## The shape

```
app/                         ← routes (URLs). Pages render; api/ handles data.
  layout.tsx                 ← global shell (nav, session, unread badge)
  page.tsx                   ← "/" redirect based on role
  login/ join/ account/      ← auth entry pages
  lessons/[code]/            ← the student lesson experience
  teacher/                   ← teacher dashboard + per-student drill-down
  admin/editor/ settings/    ← admin-only CMS + AI config
  inbox/                     ← messaging
  api/                       ← every server endpoint (see "Endpoints" below)

components/
  student/                   ← the floating tools (scratchpad, tutor, windows)
  teacher/                   ← class management UI
  messaging/                 ← inbox UI
  editor/  (Editor.tsx)      ← lesson CMS (edit-while-previewing)
  Lesson*.tsx / Quiz / CodeEditor / Nav / *Form  ← shared building blocks

lib/                         ← all logic that isn't UI. NO React here.
  db.ts                      ← the Prisma client (the only DB handle)
  auth.ts                    ← passwords, sessions, join codes, guards
  progress.ts                ← THE mastery/readiness rules (one chokepoint)
  messaging.ts               ← who-can-message-whom rules
  ratelimit.ts  sanitize.ts  ← cross-cutting safety helpers
  llm/                       ← AI provider adapter (swap providers here)
  java/piston.ts             ← code execution
  curriculum/blocks.ts       ← the lesson block model (shared types)

prisma/
  schema.prisma              ← the database shape (source of truth for data)
  seed.ts                    ← demo data + accounts
```

## The rule of thumb

- **UI look/behavior** → a file in `components/<area>/`. Styles live in `app/globals.css`,
  grouped by section with `/* ─── header ─── */` comments — search those.
- **What data an action does** → the matching `app/api/**/route.ts`.
- **A business rule** (who can do what, how mastery is computed) → a file in `lib/`.
- **The data model** → `prisma/schema.prisma`, then `npx prisma db push`.

A feature is usually one file in each layer it touches — not scattered.

## Endpoints (app/api)

| Route | Does | Guarded by |
|---|---|---|
| `auth/login` `auth/join` `auth/logout` `auth/password` | sign in/out, join a class, change password | rate-limited |
| `run` | execute Java (`lib/java/piston.ts`) | signed-in + rate limit |
| `ai` | tutor / grade / generate (`lib/llm`) | signed-in + student caps |
| `quiz` | serve summative questions (no answers) + grade server-side | signed-in |
| `progress` | log a formative attempt (refuses summative) | signed-in |
| `curriculum` `curriculum/versions` `curriculum/import` | CMS read/save/publish/history/import | ADMIN |
| `classes` | create/rename/delete/regenerate-code/kick/rename student | TEACHER/ADMIN + ownership |
| `messages` | inbox summary, thread, send | signed-in + permission (`lib/messaging`) |
| `settings` `settings/test` | AI provider config | ADMIN |

## Invariants — do not break these

1. **Mastery only changes in `lib/progress.ts`**, and only a passing SUMMATIVE (graded in
   `app/api/quiz`) can set MASTERED. Nothing else, ever.
2. **The summative answer key never reaches the browser** — questions ship without answers;
   grading is server-side.
3. **One `<LessonRenderer>`** renders lesson content for both the student reader and the
   editor preview. Change how a block looks in exactly one place.
4. **Untrusted content is plain text or sanitized**: student-influenced data (`lib/sanitize.ts`
   `stripHtml`) and AI output (`sanitizeInline`). Only admin-authored lesson HTML is rendered raw.
5. **Secrets stay in `lib/` server modules** (`"server-only"`), encrypted at rest, never in
   client components.

## Adding a feature — worked example

"Let students bookmark a lesson":
1. `prisma/schema.prisma`: add a `Bookmark` model → `npx prisma db push`.
2. `app/api/bookmarks/route.ts`: POST/DELETE, guarded by `currentUser()`.
3. `components/student/BookmarkButton.tsx`: the button.
4. Drop the button into `app/lessons/[code]/page.tsx`. Done — four files, one per layer.
