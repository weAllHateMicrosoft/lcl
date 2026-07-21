# classOS — Teacher Experience Design

The platform has a lot of working capability but it's organized *by feature*, not *by how a
teacher thinks*. This doc is the target design we build toward.

## 1. What a teacher has today (and where it lives)

| Capability | Where it is now | Problem |
|---|---|---|
| See who's stuck / mastered | `/teacher` (matrix + KPIs) | all classes mixed together |
| Manage classes, join codes | `/teacher` → ClassManager | buried in the dashboard |
| Roster: add / rename / remove | ClassManager | mixed with everything |
| Google: connect / link / import / announce | ClassManager buttons | scattered, manual |
| Per-student record | `/teacher/student/[id]` | separate page |
| Build a test | `/tests` → `/tests/[id]/edit` | global, not "this class's work" |
| Grade a test | `/teacher/test/[id]` | separate from the gradebook |
| Gradebook | `/gradebook` | separate again; all classes |
| Message students | `/inbox` | separate |
| Announcements | ClassManager 📣 | yet another spot |
| Lessons/curriculum | `/admin/editor` (admin only) | shared curriculum |

**The core problem:** a teacher thinks *"my Period 3 class"* — its students, its assignments,
its grades, its announcements. But those five things live on five different pages, each showing
*all* classes. There is no **class workspace**. Buttons are everywhere.

## 2. The target: a class-centric workspace

Lean teacher nav: **My Classes · Messages · (avatar → Account)**. Admin tools stay in a separate
admin area. Everything about one class lives at **`/class/[id]`**, tabbed:

- **Overview** — the command center: who needs attention today (stuck/coasting), upcoming due
  dates, latest activity, quick actions (post announcement, add students). Opens by default.
- **Students** — the roster in one place: add (join code *or* Google import), rename/remove,
  message, open a student's full record, at-a-glance status per student.
- **Assignments** — everything you *issue*: tests, tasks (coding exercises, readings, later live
  quizzes). Create, assign, schedule (open/close), publish. Draws questions from the shared
  curriculum. Shows sync + due-date status per item.
- **Gradebook** — *this class's* students × assignments + mastery. Click a cell to grade — grading
  lives here, not on a separate page.
- **Stream** — announcements now, the class board (Padlet-style) later. Posts auto-fan-out to
  Google Classroom + student inboxes.
- **Class settings** — name, join code, Google Classroom link + sync status, delete.

Global (cross-class) stays tiny: an **All Classes** overview (cards + one combined "who needs
attention across all my classes today") and **Messages**.

Curriculum/lessons are a *shared* asset (not per-class), so they stay in their own **Content**
area; a class's Assignments pull from it.

## 3. "Never worry about syncing" — the sync principle

- **Outbound (classOS → Google): automatic on every change.** Editing a published test re-upserts
  the assignment; changing the close date updates the due date; saving a grade pushes it; posting
  an announcement posts it. **No "sync" buttons anywhere.**
- **Inbound (Google → classOS): auto-refresh.** Roster re-syncs when the Students tab opens (+ a
  manual refresh). True real-time from Google needs push notifications (Cloud Pub/Sub) — a later
  upgrade.
- Every linked class shows a quiet **"in sync ✓ · updated 2m ago"** so teachers *trust* it and
  stop thinking about it.

## 4. Where future features slot in (no new top-level clutter)

| Feature | Home |
|---|---|
| Google SSO (student one-click login) | login page — activates imported accounts instantly |
| Class board (Padlet) | Stream tab |
| Live quiz (Kahoot) | Assignments → "Run live" on any quiz |
| Chat code-review (attach code, propose edits) | Messages + student record |
| Reading room / AI pair-programmer | student tools; teacher assigns them as tasks in Assignments |

## 5. The AI layer — the differentiator (deeper integration)

Beyond the per-student tutor we already have, the unique edge is **AI that works for the teacher
on the class's real data**:

- **Class AI assistant** — a per-class daily brief + actions: *"2.4 integer division: 5/12
  mastered — regenerate a targeted mini-set? Ada hasn't logged in 6 days — nudge her?"* It can
  draft the announcement, generate the practice, and flag who to check on.
- **Adaptive assignments** — AI builds per-student practice from each student's gaps.
- **Lesson doctor** — reads mastery data across the class, flags weak lessons, proposes edits.
- **AI co-grader** — rubric generation + FRQ/code grading (partially built) + consistency checks.
- Student-facing: adaptive path, pair-programmer, reading companion.

## 6. Roadmap (phased, one focused build each)

- **Phase A — Make it good (reorg):** build the class workspace `/class/[id]` and move existing
  features into its tabs; make all outbound Google sync automatic. *No new features — coherence.*
- **Phase B — Adoption:** Google SSO for students; roster auto-refresh.
- **Phase C — Interaction:** class board / Stream; live quiz; chat code-review.
- **Phase D — The AI layer:** class assistant, adaptive assignments, lesson doctor.

Recommendation: **do Phase A first.** Reorganizing before adding more prevents the mess from
compounding, and every later feature drops cleanly into a tab instead of a new scattered button.

## DECIDED (owner)
- **Build order: reorg (Phase A) first**, built non-breaking (new `/class/[id]` workspace goes up
  alongside old pages; migrate tab by tab; retire old pages at the end).
- **North star:** *use AI to deliver more personalized content to students and remove busywork from
  teachers, so they can focus on students and the lesson.* Every AI feature must save teacher work
  or personalize for a student.

## Phase A build slices
- **A1 (this slice):** workspace shell + tab nav; `/class` list; Overview; **Students** tab (roster +
  add + Google import); **Settings** tab (name/code/delete + Google connect/link); **Stream** tab
  (announcements). Assignments/Gradebook tabs link to the existing pages for now.
- **A2:** Assignments tab (class-scoped tests: create/schedule/publish/results in-tab) + auto-sync
  outbound to Google on every change (no sync buttons).
- **A3:** Gradebook tab (class-scoped grid + inline grading) ; retire `/teacher`, `/gradebook` global
  pages (keep an "all classes" overview only).
