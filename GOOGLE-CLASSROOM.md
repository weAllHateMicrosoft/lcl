# Google Classroom integration

classOS is the control center; it syncs *out* to each teacher's own Google Classroom.

## Architecture (multi-teacher from day one)
- Each teacher connects **their own** Google account → we store **their** encrypted
  `googleRefreshToken` on the `User`. A `Class` links to one Google course via `googleCourseId`.
- Every Classroom API call goes through `lib/google.ts` → `googleFetch(userId, path, init)`,
  which loads that teacher's token, refreshes it automatically, and retries once on 401.
- Add a new Classroom capability = add a one-line helper in `lib/google.ts`. That's the
  "do anything" surface.

## Scopes (`lib/google.ts` → `GOOGLE_SCOPES`)
- `classroom.courses.readonly` — list the teacher's courses (for the import picker)
- `classroom.rosters.readonly` — match Google students ↔ classOS students
- `classroom.announcements` — post to the class stream
- `classroom.coursework.students` — **create assignments + push grades** (this replaced the
  broken `coursework.me`, which caused the 403 on CreateCourseWork)

Add more scopes here as features need them (e.g. `classroom.courses` to *create* courses,
`classroom.push` for webhooks). Adding scopes = users must re-consent.

## ⚠️ The real gate for "any teacher": OAuth verification
The code is fully multi-teacher, but Google restricts *who can consent*:
- **Testing mode (now):** only the emails you add under GCP → OAuth consent screen → **Test
  users** (max 100) can connect. Fine for a pilot.
- **Public:** you must **Publish** the app, which — because Classroom scopes are sensitive/
  restricted — triggers **Google verification**: a public homepage + **privacy policy URL**,
  domain verification, brand review, and (for restricted scopes) a security assessment.
  Plan for days-to-weeks. Start this early if you want real teachers before term.

## Environment
Set in `.env` (local) **and** Vercel (production):
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Redirect URI is derived from the request origin, so register **both** in GCP → Credentials →
  Authorized redirect URIs:
  - `http://localhost:3000/api/auth/google/callback`
  - `https://<your-app>.vercel.app/api/auth/google/callback`
  (Override with `GOOGLE_REDIRECT_URI_OVERRIDE` only if you must pin one.)

## Status
- [x] Step 1 — schema (`User.googleRefreshToken`/`googleEmail`, `Class.googleCourseId`), scopes
      fixed, token-refresh foundation (`lib/google.ts`), connect flow persists tokens to the
      signed-in teacher (`/api/auth/google` → consent, `/callback` → store + redirect
      `/teacher?google=connected`).
- [ ] Step 2 — "Connect Google Classroom" button in ClassManager; course picker; link a course.
- [ ] Step 3 — assignment sync on Test publish (with `dueDate` from `closeAt`), grade passback
      on grading, announcement sync from the class board.

## The `?google=` redirect codes (for the ClassManager UI)
`connected` · `denied` · `nocode` · `badstate` · `exchange` · `norefresh` · `error`
