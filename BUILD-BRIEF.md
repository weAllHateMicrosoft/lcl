# classOS — Build Brief (Production v1)

Companion to `SPEC.md`. This is the brief for turning the prototypes into a **real,
self-hosted, editable, AI-integrated platform** that the owner runs and fully controls.
Guiding principle from the owner: **maximum freedom** — control over content, data, keys,
and deployment. Design every decision to preserve that.

The prototypes already demonstrate the target UX:
- `classOS-prototype-v4.html` — student experience: lessons, scratchpad, code execution,
  output-based + AI grading, AI tutor, readiness-based mastery, teacher dashboard.
- `classOS-lessons.html` — the lesson content + the block structure (`LESSONS` array).
- `classOS-editor.html` — the admin lesson editor (block CMS) and the curriculum data shape.

Build the real thing so these three collapse into one app with a database behind them.

---

## Stack (unchanged from SPEC, confirmed)
Next.js (App Router, TS) · Postgres (Neon/Supabase) + Prisma · Auth.js · server-side AI
adapter · CodeMirror editor · Piston/Judge0 for Java execution. Deploy on Vercel (app) +
Neon/Supabase (db), or any Node host. All secrets server-side.

---

## 1. Provider-agnostic AI (bring-your-own key)

The owner will supply their own API key and wants to swap providers freely (free tiers change
monthly). Do NOT hardcode Anthropic.

- Build one server-side `llm.complete({system, messages, json?})` adapter with pluggable
  backends: **Anthropic**, **Google Gemini** (AI Studio), **Groq**, **OpenRouter**. Most speak
  the OpenAI-compatible schema — implement that once and treat Gemini/Groq/OpenRouter as
  base-URL + model swaps; keep a thin Anthropic path.
- **Admin Settings page** (DB-backed, not env-only): provider dropdown, API key field
  (encrypted at rest), model name, and per-feature model overrides (tutor vs grading vs
  generation). Changing provider is a settings edit, never a redeploy.
- Recommended default for a class: **Gemini Flash free tier** (~1,500 req/day, no card, no
  expiry as of mid-2026). Groq/OpenRouter as fallback lanes.
- **Privacy note to surface in the admin UI:** most free tiers train on submitted prompts.
  Fine for lesson content and synthetic practice; flag it beside the key field so the owner
  makes an informed choice about real student data (ties to the board-policy checkpoint).
- Keep the three AI contracts from SPEC: `explain`, `feedback`, `hint` — plus `generatePractice`
  (JSON out) and `gradeCode` (JSON out) and `runJava`-as-fallback, all routed through the adapter.

## 2. Curriculum CMS (the editable platform)

Content is data the owner edits in-app — never hardcoded. Mirror the `classOS-editor.html` UX.

Prisma additions (extends SPEC's curriculum tree):
```
Chapter { id, order, title, lessons Lesson[] }
Lesson  { id, chapterId, code, order, title, goal, blocks Json, exercise Json, quizBank Json }
```
- `blocks` is an ordered array of typed blocks: `heading | prose | code(+out) | callout(kind,title,body) | exercise`. Rendered by a shared `<LessonRenderer>` used by both the student reader and the editor preview (one renderer, two consumers).
- **Admin editor**: add/edit/reorder/delete blocks, add/rename chapters & lessons, drag to
  reorder. Export/import the whole curriculum as JSON (portability = freedom). Autosave.
- Maximum-freedom extras worth building in early: duplicate a lesson, reorder via drag,
  a "reveal full boilerplate" toggle per code block, and versioned snapshots of a lesson so
  edits are reversible.

## 3. Merge the AI platform + lessons

One app, one nav. A lesson page shows: the rendered blocks → scratchpad → practice quiz →
AI-generated practice → graded coding exercise → AI tutor, exactly as prototype-v4, with the
lesson content coming from the CMS above. Mastery/readiness engine and teacher dashboard as in
v4, all reading/writing the real DB.

## 4. Simplified input for beginners (`input("...")`)

Wrap student code before compilation so beginners skip Scanner boilerplate. Injected template:
```java
import java.util.Scanner;
public class Main {
    static Scanner __sc = new Scanner(System.in);
    static String input(String p){ System.out.print(p); return __sc.nextLine(); }
    static int inputInt(String p){ System.out.print(p); return Integer.parseInt(__sc.nextLine().trim()); }
    static double inputDouble(String p){ System.out.print(p); return Double.parseDouble(__sc.nextLine().trim()); }
    public static void main(String[] args) {
        /* STUDENT CODE HERE */
    }
}
```
Students write `String name = input("Your name? ");`. The runner splices their code into the
template, compiles the whole thing, and maps any error line numbers back to the student's view.
Add an admin toggle to show/hide the full boilerplate for advanced students. Update lesson 2.3
content to teach `input()` / `inputInt()` (edit it in the CMS, not in code).

## 5. Roles, data, and control

- **Roles:** `ADMIN` (owner — full CMS + settings + all data), `TEACHER` (dashboard + own
  classes), `STUDENT`. Auth.js.
- **Tracking:** persist every attempt (quiz, code run, AI-generated set, clean quiz) and every
  AI call (tokens + cost) per student — the record/readiness engine from v4, now durable.
  Teacher dashboard + per-student drawer read from it. Add CSV export of all data (freedom).
- **The honesty rule stays enforced in one `updateProgress()` chokepoint:** only a passing
  SUMMATIVE (locked-down) attempt sets `MASTERED`; everything else feeds readiness/flags only.

---

## Deployment path (own it end-to-end)

1. Claude Code scaffolds the repo from `SPEC.md` + this brief; commit to the owner's GitHub.
2. Provision Postgres (Neon/Supabase free tier) → set `DATABASE_URL`.
3. Deploy the app to Vercel (free hobby tier) from the repo.
4. Java execution: start on Piston public API; self-host Piston (Docker) when class size needs it.
5. In Admin Settings, the owner pastes their own LLM key (Gemini to start) and picks the model.
6. Seed the curriculum by importing the JSON from `classOS-editor.html` / `classOS-lessons.html`.
7. Owner logs in as ADMIN: edits lessons, watches data, swaps providers — all self-served.

Result: a platform the owner hosts, whose content they edit in-app, whose keys and data they
hold entirely, and which no longer depends on this chat to change.

---

## Suggested build order (production)
1. Auth + roles + the provider-agnostic `llm` adapter + Admin Settings (keys work end-to-end).
2. Curriculum schema + `<LessonRenderer>` + the admin CMS editor (content is editable).
3. Student lesson page wiring the renderer + scratchpad + `runJava` (Piston) + the `input()` template.
4. Quizzes, AI-generated practice, code grading (output-based verdict + AI feedback), readiness engine.
5. Teacher dashboard + per-student records + CSV export.
6. Deploy; import curriculum; adversarial pass on the anti-solution rule.
