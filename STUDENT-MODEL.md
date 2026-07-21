# classOS — Student Model & Data Layer (design)

> Status: **design, not yet built.** This pins the model on paper before we touch
> the schema, because it's the platform's spine — easy to get subtly wrong, expensive
> to change once data is flowing.
>
> North star (owner): *"Using AI to deliver more personalised content to students and
> save troubles for teachers so they can focus on students and the lesson itself."*

---

## 0. Why this exists — the current signal is not defensible

Today mastery is one lesson-level boolean. In [`lib/progress.ts`](lib/progress.ts):

- `readiness` = average of the **last 5 attempt scores**.
- `MASTERED` is stamped the instant **one** `QUIZ_SUMMATIVE` passes — regardless of
  *which* concepts that quiz touched.
- `Lesson.objectives` exists but is **decorative**: a `Json?` string array fed to the
  tutor as "scope." **Nothing measures against it.**

So a student can be `MASTERED` on a lesson having never demonstrated the one skill the
lesson exists to teach. The problem in one line: **evidence attaches to lessons, not to
skills, and the system never admits when it doesn't know.** This document fixes both.

---

## 1. Five principles (these govern every decision below)

1. **Revealed curriculum, not authored curriculum.** The AI must never hand the teacher
   a taxonomy and call it truth. The teacher may not be able to enumerate every skill up
   front — but every question they write *reveals* one. So the system infers a **draft
   skill-map from the teacher's real questions and lessons**, and the teacher's job is
   *curation* (rename / merge / split / delete), never authoring. The map sharpens as the
   question bank grows; it is never "done" and never blocks the platform.

2. **Capture now, analyse later.** You can always ignore data you captured; you can never
   recover data you didn't. Log liberally and *structure* it well without pretending to
   know today every question you'll ask of it later.

3. **Unknown is a first-class answer.** Calibrated uncertainty is the feature. The system
   must be willing to say *"insufficient evidence — I wouldn't judge yet"* and always show
   the evidence behind any judgement it does make. Honest uncertainty is what earns a
   teacher's trust; false green checkmarks destroy it.

4. **AI proposes, teacher disposes.** The AI surfaces observations and *offers* actions
   ("4 students are shaky here — draft a targeted practice set?"). It acts autonomously
   only in genuinely safe lanes; anything consequential waits for one teacher click.

5. **Subject-agnostic structure.** Nothing in the model hardcodes Java. Skills, evidence,
   mastery, and rollups are structural, so extending to another subject is data, not code.

---

## 2. The substrate — an append-only event log

The one thing we cannot retrofit. Most interesting traces evaporate today: `Attempt`
keeps pass/fail blobs, `AiCall` keeps *token counts but not the conversation*. That last
one is the richest design signal we have, and we currently keep the bill and discard the
content.

### 2.1 Table

```prisma
model Event {
  id      String   @id @default(cuid())
  at      DateTime @default(now())
  userId  String?          // null = system / anonymous
  classId String?          // context, denormalised for cheap slicing
  type    String           // namespaced: "quiz.answer", "tutor.message", ...
  payload Json             // versioned; include { v: 1, ... }

  @@index([type, at])
  @@index([userId, at])
  @@index([classId, at])
}
```

- **Append-only.** Never updated, never used to *run* the app — purely for analysis and
  for deriving the student model. Operational tables (`Attempt`, `Progress`,
  `TestSubmission`) keep doing their job; events are a parallel, lossy-tolerant stream.
- **Best-effort, non-blocking writes.** Instrumentation must never slow or break a
  student request. Fire-and-forget via a small `logEvent()` helper that swallows errors.
- **Namespaced `type`** is what makes the log *organised* rather than a junk drawer.
- **Versioned `payload`** (a `v` field) so a schema change months from now doesn't
  corrupt old rows.

### 2.2 Event taxonomy (v1 — start here, grow later)

High-value, low-noise. Skip mouse-move-level firehose telemetry (high volume, ~zero
insight).

| `type`            | Emitted when                          | Key payload fields |
|-------------------|---------------------------------------|--------------------|
| `lesson.view`     | student opens a lesson                 | lessonId, code |
| `block.dwell`     | student leaves a lesson/block          | lessonId, blockId, ms, scrollPct |
| `quiz.answer`     | **any** question answered (not just summative) | lessonId?, testId?, questionId, skillIds[], correct, chosen, ms, difficulty |
| `code.run`        | code exercise executed                 | lessonId, passed, verdict |
| `tutor.message`   | a tutor turn (student + AI)            | lessonId?, role, text, tokens |
| `hint.reveal`     | student reveals a hint/answer          | lessonId, questionId |
| `test.submit`     | test submitted                         | testId, autoScore, maxScore |
| `mastery.change`  | Progress status/confidence changes     | lessonId, from, to, confidence |

`quiz.answer` is the load-bearing one: **item-level, everywhere, including practice**, and
it records *which distractor* was chosen — distractor choice tells you *why* a student is
wrong, not just that they are.

### 2.3 Privacy / retention (build the toggle now)

Students are the subjects, so a **retention + anonymisation** control belongs in from the
start (cheap now, awkward to bolt on later):

- Store as a `Setting` (e.g. `data:retention = { rawDays: 180, thenAnonymise: true }`).
- A periodic job strips `userId` (and PII in payloads) from events older than `rawDays`,
  keeping the aggregate shape for design analysis.
- Lets you share design findings without exposing individuals, and gives a clean
  "forget this student" path.

---

## 3. The competency model (projections over the substrate)

Key idea: **`Progress` and the evidence ledger are derived reads of the event log.**
The mastery view is one projection; design meta-analysis is a *different* projection over
the *same* events. One capture layer, two payoffs — we are not building two things.

### 3.1 Skills as provisional, first-class rows

Promote objectives from a decorative JSON blob to real rows — but *provisional* ones.

```prisma
model Skill {
  id        String  @id @default(cuid())
  code      String? // teacher-facing, optional (e.g. "2.3b")
  statement String  // "trace a recursive call"
  unit      String? // free-text grouping for rollup; teacher-owned
  difficulty Int?    // 1..5, a hint not a law
  origin    String  @default("ai")   // "ai" = suggested, "teacher" = curated/confirmed
  confidence Float  @default(0)       // AI's confidence this skill is real/distinct
  // links
  questionSkills QuestionSkill[]
  evidence       Evidence[]
}

// Many-to-many: a question can exercise several skills, a skill many questions.
model QuestionSkill {
  id         String @id @default(cuid())
  questionId String // stable id from the Question JSON
  skillId    String
  weight     Float  @default(1)
  origin     String @default("ai")   // ai-tagged vs teacher-confirmed
}
```

- `origin` + `confidence` make the *provisional* nature explicit: AI suggestions are
  visibly hypotheses until a teacher confirms them. The teacher never sees "the truth" —
  they see *"here's the structure implicit in your material; correct me."*
- Nothing is mandatory. An untagged question still works; it just contributes no
  skill-level evidence. The system degrades gracefully toward the current behaviour.

### 3.2 The evidence ledger

Each answered question becomes evidence against the skill(s) it tests — a projection of
`quiz.answer` events:

```prisma
model Evidence {
  id         String   @id @default(cuid())
  userId     String
  skillId    String
  correct    Boolean
  difficulty Int?
  weight     Float    @default(1)
  source     String   // "practice" | "summative" | "test" | "tutor"
  at         DateTime @default(now())

  @@index([userId, skillId, at])
}
```

### 3.3 Mastery estimate — with confidence, and "unknown" allowed

Per `(user, skill)`, computed from evidence — **not** a single quiz result:

- **Estimate** (0..1): recency-weighted, difficulty-weighted correctness. A hard item
  correct counts more; a slip on a hard item drops it.
- **Confidence** (0..1): a function of *how much* evidence, *how recent*, *across how many
  difficulties*. Three easy MCQs → low confidence → **"insufficient — not assessed."**
  Five items across difficulties, recent, consistent → high confidence → "mastered."
- The UI renders three states, never a bare checkmark: **known-strong / known-weak /
  not-enough-evidence.** The third is a feature, not a gap.

### 3.4 Rollup: skill → lesson → unit → chapter

Each level is a weighted aggregate of the level below, **carrying confidence upward**. A
unit isn't "green" — it's "strong (high confidence)" or "shaky on 2 of 6 skills" or "not
enough evidence yet." This is the chapter-by-chapter / unit-by-unit view the owner asked
for, and it's honest about what it doesn't know.

> Migration note: the existing `Progress.status` (`MASTERED` etc.) stays as a coarse,
> cheap-to-read summary derived from the rollup, so nothing downstream breaks. The old
> "one summative → MASTERED" chokepoint is *relaxed*, not removed: it can still light the
> first evidence, but mastery is now earned across accumulated evidence, not a single pass.

---

## 4. The AI layer — two jobs, one contract

### 4.1 Cold job — the syllabus builder (needs zero students)

Runs on the teacher's **existing** curriculum, so it's useful *today* with an empty class:

1. Read a lesson's blocks + questions.
2. Cluster the latent skills; propose `Skill` rows (`origin: "ai"`, with confidence).
3. Auto-tag questions → skills (`QuestionSkill`, `origin: "ai"`).
4. **Flag gaps**: a skill with no questions measuring it → "the mastery signal is blind
   here." A question tagged to nothing → "unmeasured."
5. Teacher curates in a lightweight review UI: confirm / rename / merge / split / delete.
   Confirmation flips `origin` to `"teacher"`.

This is the concrete proof of the "revealed curriculum" principle — and the natural first
build, because it doesn't wait on enrolment.

### 4.2 Warm job — the per-student narrative (needs evidence)

Reads the evidence ledger for a student and writes a **defensible narrative**, not a
score: *"consistently strong on loops; both hard recursion items failed — recursion is the
gap, not 'lesson 4'. Suggest: a short recursion practice set (draft ready)."* Always cites
the evidence. Surfaces to the teacher on the class Overview tab; acts only on click.

### 4.3 Interaction contract (principle 4, made concrete)

- Every AI judgement ships with its evidence and a confidence.
- Every AI *action* is a proposal with a one-click accept, except a small allow-list of
  safe autonomous acts (e.g. generating a *draft* practice set — nothing published, nothing
  sent to a student, without a human click).

---

## 5. Vertex AI — where it plugs in

Reason (owner): free Gemini API quota won't carry a Pro model or heavy background jobs;
GCP free credits will.

- **Split by workload:** heavy/pro reads (§4.1 clustering, §4.2 narratives) → **Gemini Pro
  on Vertex** (credits); cheap interactive turns (tutor, quick grade) → free tier / existing
  keys.
- **The one wrinkle:** Vertex doesn't use a static API key like the other providers — it
  needs a short-lived OAuth access token minted from a **service-account** (JWT → token
  exchange, cached ~55 min). Vertex exposes an OpenAI-compatible endpoint, so once the
  token-minting exists it drops into the existing compat path in
  [`lib/llm/providers.ts`](lib/llm/providers.ts) with just a bearer header + regional base URL.
- Add as a new `vertex` provider in the rotation; **build it when we hit the first heavy
  job**, not in a vacuum.

---

## 6. Build order

1. **Event log** — `Event` model + `logEvent()` helper + emit the v1 taxonomy from the key
   interaction points. Retention/anonymisation `Setting` + toggle. *(The substrate; also
   immediately starts banking design data.)*
2. **Skill / QuestionSkill / Evidence** schema — provisional, non-blocking, graceful
   degrade.
3. **Syllabus builder (cold AI job)** + teacher review UI — proves "revealed curriculum"
   on the real curriculum, needs no students.
4. **Mastery estimator + rollup** — skill → lesson → unit → chapter, with confidence and
   an explicit "not-enough-evidence" state; keep `Progress.status` as the cheap summary.
5. **Vertex provider** — service-account token minting; route heavy jobs here.
6. **Per-student narrative (warm AI job)** + Overview surfacing, under the propose/dispose
   contract.

Each step is independently useful and non-breaking; the platform keeps working throughout.

---

## 7. Guiding stance & decisions

**Openness is the default (owner).** *"Open and free"* — students see as much as they can,
admin sees everything. This is a product value, not just a settings choice, so it shapes the
UI throughout:

- **Students see their own full skill map**, including the honest "not enough evidence yet"
  state. Transparency + calibrated uncertainty reinforce each other: a student seeing *"I
  haven't shown recursion yet"* is a feature, not a discouragement — provided it's framed as
  *a next step, not a verdict*. (Framing is the only real care needed; visibility itself is open.)
- **Admin/owner sees everything** — raw events, per-student evidence, cross-class analysis,
  no artificial walls.
- The one genuine constraint that still holds even under "open": **answer keys / model
  answers are never sent to a student before they've answered** (existing security invariant
  — server-side grading). Openness is about *insight into their own learning*, not leaking
  the test.

### Resolved
- **Student visibility** → **open**: students see their own skill map + confidence states.
- **Admin visibility** → **open**: full access to events and derived model.
- **Skill granularity** → start **coarse** (≈one skill per lesson objective); let curation
  split finer over time.

### Still to tune (sensible default now, adjustable later)
- **Confidence thresholds** — what evidence count / spread flips "not assessed" →
  "assessed." Start with a legible default, tune once real data exists.
- **Retention window** — `rawDays` before anonymisation (leaning 180).
