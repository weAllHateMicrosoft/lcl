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
- the **free public Piston API** for real Java execution

### Try the demo
Use the **"acting as"** switcher (top-right) to move between roles:
- **Student** → open a lesson, use the scratchpad, run the graded exercise, take practice + the
  🔒 clean quiz (the only thing that turns a lesson **MASTERED**), ask the AI tutor.
- **Teacher** → the dashboard with the mastery matrix, flags, recent activity, and AI cost.
- **Admin (Owner)** → the lesson **Editor** (live-preview CMS with JSON export/import) and
  **Settings** (drop in a real AI key when you have one).

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
  api/                run (Piston) · ai (adapter) · progress · curriculum · settings · user
components/
  LessonRenderer      ONE renderer, used by the reader AND the editor preview
  LessonWorkspace     scratchpad · graded exercise · practice · tutor · summative
  Quiz · CodeEditor · Editor · SettingsForm · Nav
lib/
  llm/                provider-agnostic adapter (stub/gemini/groq/openrouter/anthropic),
                      JSON repair, fallback lanes, cost tracking
  java/piston.ts      real Java execution + the beginner input() template
  progress.ts         THE honesty chokepoint — only a passing summative → MASTERED
  settings.ts         DB-backed config + encrypted keys
  auth.ts             DEV role shim (swap for Auth.js — see below)
prisma/
  schema.prisma       Chapter · Lesson · User · Attempt · Progress · AiCall · Setting
  seed.ts             Unit 2 starter lessons + demo class
```

---

## Maturing it (the seams are already in place)

Each is a self-contained upgrade — the surrounding code doesn't change:

| Step | What to do | Where |
|---|---|---|
| **Real auth** | Replace the dev shim with Auth.js; keep `currentUser()` / `requireRole()` | `lib/auth.ts` |
| **Postgres** | Change datasource to `postgresql`, set `DATABASE_URL` (Neon/Supabase), `db:push` | `prisma/schema.prisma` |
| **Deploy** | Push to Vercel; it builds from this repo | — |
| **Self-host Java** | Point `PISTON_URL` at your own Piston (Docker) when class size grows | `.env` |
| **Fallback lanes** | Configure a 2nd provider so a hit rate-limit auto-fails-over | Settings + `lib/llm` |
| **Cost caps** | Per-student/day call caps + global kill switch (guard in `lib/llm`) | roadmap |
| **CSV export** | Dump `Attempt`/`Progress` for the teacher | roadmap |
| **Import full Unit 2** | Editor → Import JSON (only 4 lessons are seeded so far) | `admin/editor` |

---

## Notes / rough edges (it's a prototype)

- Admin/Teacher pages throw if you visit them while "acting as" a Student — switch role first
  (the nav hides the links for you). Auth.js will make this a clean redirect.
- The graded exercise's pass/fail is **output-comparison** (authoritative); the AI only writes
  the coaching — so grading never depends on a hallucinated verdict.
- Only 4 lessons are seeded; the rest of your Unit 2 content imports via the editor.
