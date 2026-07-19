# classOS

A self-hosted, editable, AI-integrated platform for teaching intro Java. It collapses the
three prototypes (`classOS-prototype-v4`, `classOS-lessons`, `classOS-editor`) into one real
app with a database behind it.

Guiding principle: **maximum freedom** — you own the content, the data, the keys, the deploy.

---

## Run it (zero accounts, ~2 minutes)

```bash
npm install
npm run setup      # generates Prisma client, creates the SQLite DB, seeds Unit 2 + demo users
npm run dev        # http://localhost:3000
```

That's it. No API key, no Postgres, no Docker. The app boots on:
- **SQLite** (a local `prisma/dev.db` file) instead of Postgres
- an **offline "stub" AI provider** (canned tutor/grading) instead of a paid key
- **Compiler Explorer's free API** for real Java execution (the public Piston API went
  whitelist-only in Feb 2026; set `PISTON_URL` to use a self-hosted Piston instead)

### Sign in (real accounts — seeded for you)
| Who | How |
|---|---|
| **Student** | Go to `/join`, enter class code **JAVA26** + any name — no email/password. |
| **Teacher** | `/login` → `teacher@classos.dev` / password **printed by the seed** |
| **Admin (you)** | `/login` → `admin@classos.dev` / password **printed by the seed** |

Staff passwords are **random on every seed** (no public defaults) — the seed prints them, so
copy them from the terminal. Pin them with `ADMIN_PASSWORD` / `TEACHER_PASSWORD` env vars if
you prefer, and change them any time at `/account`.

- **Student** → open a lesson, use the scratchpad, run the graded exercise, take practice + the
  🔒 clean quiz (the only thing that turns a lesson **MASTERED**), ask the AI tutor.
- **Teacher** → classes + join codes, the mastery matrix, flags, recent activity.
- **Admin** → everything above plus the lesson **Editor** and **Settings** (AI keys).

Teachers create classes on the Teacher page; each gets a short join code students type at
`/join`. A returning student who enters the same name in the same class gets their progress
back — simple on purpose (no student emails), same tradeoff Kahoot/ClassDojo make.

---

## Adding a real AI key (whenever your boss sponsors one)

Go to **Admin → Settings**. Pick a provider, paste the key, hit **Test key**, **Save**. No redeploy.
- **Recommended free start: Google Gemini Flash** (~1,500 req/day, no card).
- **Groq** and **OpenRouter** are fast free fallbacks.
- Keys are **encrypted at rest** and never sent to the browser.
- Heads-up shown in the UI: most free tiers train on submitted prompts — fine for lesson content
  and synthetic practice; weigh it before sending real student data.

Nothing is hardcoded to one provider — Groq / Gemini / OpenRouter share one OpenAI-compatible
client; Anthropic has a thin path. See `lib/llm/`.

---

## How it's laid out

```
app/
  lessons/[code]/     student reader + interactive workspace
  teacher/            mastery dashboard (reads real attempts)
  admin/editor/       lesson CMS (live preview, export/import)
  admin/settings/     provider/key config
  api/                run (Java) · ai (adapter) · auth · classes · progress · curriculum · settings
components/
  LessonRenderer      ONE renderer, used by the reader AND the editor preview
  LessonWorkspace     scratchpad · graded exercise · practice · tutor · summative
  Quiz · CodeEditor · Editor · SettingsForm · Nav
lib/
  llm/                provider-agnostic adapter (stub/gemini/groq/openrouter/anthropic),
                      JSON repair, fallback lanes, cost tracking
  java/piston.ts      real Java execution (Compiler Explorer / self-hosted Piston) + input() template
  progress.ts         THE honesty chokepoint — only a passing summative → MASTERED
  settings.ts         DB-backed config + encrypted keys
  auth.ts             real auth: scrypt passwords, signed sessions, class join codes
prisma/
  schema.prisma       Chapter · Lesson · User · Attempt · Progress · AiCall · Setting
  seed.ts             Unit 2 starter lessons + demo class
```

---

## Maturing it (the seams are already in place)

Each is a self-contained upgrade — the surrounding code doesn't change:

| Step | What to do | Where |
|---|---|---|
| **Postgres** | Change datasource to `postgresql`, set `DATABASE_URL` (Neon/Supabase), `db:push` | `prisma/schema.prisma` |
| **Deploy** | Push to Vercel; it builds from this repo | — |
| **Self-host Java** | Point `PISTON_URL` at your own Piston (Docker) when class size grows | `.env` |
| **Fallback lanes** | Configure a 2nd provider so a hit rate-limit auto-fails-over | Settings + `lib/llm` |
| **Cost caps** | Per-student/day call caps + global kill switch (guard in `lib/llm`) | roadmap |
| **CSV export** | Dump `Attempt`/`Progress` for the teacher | roadmap |
| **Author remaining exercises** | 11 of the 15 lessons don't have a graded exercise/quiz bank yet — add them in the editor's Exercise & Quiz sections | `admin/editor` |

---

## Notes / rough edges (it's a prototype)

- Hosting it? Follow **DEPLOY.md** — it's a complete first-time walkthrough including the
  security model and a post-deploy test checklist.
- The graded exercise's pass/fail is **output-comparison** (authoritative); the AI only writes
  the coaching — so grading never depends on a hallucinated verdict.
- All 15 Unit 2 lessons are seeded (from `prisma/curriculum.seed.json`); 4 of them (2.1, 2.2,
  2.10, 2.11) have graded exercises + quiz banks, the rest need theirs authored in the editor.
  Lessons without a quiz bank hide the practice/clean-quiz panels; without an exercise, hide
  the coding panel. The scratchpad, generator, and tutor work on every lesson.
