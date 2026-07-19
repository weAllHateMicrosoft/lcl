# Hosting classOS — first-timer's walkthrough

You'll end up with: your app at `https://<something>.vercel.app` (Vercel runs the code),
your data in a real Postgres database at Neon (accounts, progress, curriculum, keys), and
auto-deploys — every `git push` updates the live site. Both services are free-tier; total
time is ~30 minutes.

**The mental model:** Vercel = the restaurant, Neon = the pantry. Your laptop stops being
the server; it becomes just the place you edit code from.

---

## Step 0 — What's already handled (the security audit)

Done in code, no action needed, listed so you know the posture:

| Threat | Defense |
|---|---|
| Guessing/forging admin sessions | Signed session cookies; **app refuses to boot in production with a weak/default `ENCRYPTION_KEY`** |
| Public default passwords | Seed generates **random staff passwords** and prints them; change any time at `/account` |
| Students reading the clean-quiz answer key | The summative bank **never leaves the server**; grading is server-side (`/api/quiz`) |
| Students faking MASTERED via devtools | `/api/progress` refuses summative attempts; only server-graded quizzes can master |
| Students planting HTML that runs in your browser | Teacher pages render student-influenced data as plain text; AI quiz output is sanitized |
| Password brute force | Login rate-limited (5/email, 20/IP per 10 min) |
| Join-code guessing / student spam | Join rate-limited, classes capped at 100 |
| One student burning the AI quota / hammering the code runner | 150 AI calls/day per student + per-minute limits |
| Clickjacking / MIME sniffing | Security headers in `next.config.mjs` |
| API keys at rest | AES-256-GCM encrypted in the DB, never sent to the browser |

Known limits (fine for a classroom, good to know): students are identified by name+class
(anyone with the code who types the same name gets that account — visible to you either way);
rate limits are per-server-instance, not global; there's no "forgot password" email flow
(reset = re-run the seed, or ask Claude to add a reset).

---

## Step 1 — Two secrets, saved somewhere safe

In your terminal (in the project folder):

```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output line into a note. This key **signs every login session and encrypts your AI
keys** — treat it like a master password, and never change it casually (changing it signs
everyone out and orphans the encrypted AI keys).

Decide your admin password now too (or let the seed generate one and copy it when printed).

## Step 2 — Neon (the database), ~5 min

1. Go to **https://neon.tech** → sign up (GitHub login is easiest, no card).
2. Create a project — name it `classos`, pick the region closest to your school.
3. On the dashboard, find **Connection string**, choose "Prisma"/pooled if offered, and copy
   it. It looks like `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`.
   That URL contains the DB password — same note, safe place.

## Step 3 — Point the code at Postgres

1. In `prisma/schema.prisma`, change the datasource: `provider = "sqlite"` → `provider = "postgresql"`.
2. In `.env`, replace `DATABASE_URL` with the Neon connection string, and replace the dev
   `ENCRYPTION_KEY` with your real one from step 1.
3. Create the tables and load your curriculum + accounts:

```bash
npm run db:push
ADMIN_PASSWORD='your-chosen-password' npm run db:seed
```

The seed prints the sign-in details — **copy them now**. (From here on, your laptop's dev
server also uses Neon: one database everywhere, which is simpler and means what you test
locally is exactly what's live.)

4. Commit and push:

```bash
git add -A && git commit -m "Switch to Postgres for hosting" && git push
```

> Repo tip: keep the GitHub repo **private** (Settings → General → Danger Zone → visibility).
> Nothing secret is committed, but your lesson content is your work.

## Step 4 — Vercel (the app), ~10 min

1. Go to **https://vercel.com** → sign up **with your GitHub account**.
2. **Add New… → Project** → Import your `lcl` repository (it'll detect Next.js — accept defaults).
3. Before hitting Deploy, open **Environment Variables** and add exactly two:
   - `DATABASE_URL` = the Neon connection string
   - `ENCRYPTION_KEY` = your key from step 1
4. **Deploy.** ~2 minutes later you get your URL. That's the site.

Every future `git push` to `main` redeploys automatically. That's your whole release process.

## Step 5 — Prove it works (do these in order, ~10 min)

1. Open the URL → you land on `/join`. Good: strangers see a join form, not data.
2. `/login` as **admin** → change your password at **Account** → open **Settings**, paste
   your Gemini key, **Test key** (the key now lives encrypted in Neon).
3. **Teacher page** → create a real class → note its join code.
4. Open a **private/incognito window** (you = a student now) → `/join` with the code →
   do a practice quiz, run code in the scratchpad, try the clean quiz.
5. Back as admin: teacher dashboard shows the student; click their name — every attempt and
   missed question is there.
6. **Editor**: make a small edit → it shows `● DRAFT` → check the incognito student still
   sees the old version → **Publish** → student sees the new one after refresh.
7. The paranoid checks (both should fail): visit `/admin/settings` in the incognito student
   window → "Admin area" notice, no data. And in the student window's devtools console, run:
   `fetch('/api/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lessonCode:'2.1',kind:'QUIZ_SUMMATIVE',passed:true})}).then(r=>r.json()).then(console.log)`
   → you should see the refusal: summative is graded server-side.

If all seven pass, you're hosted and the honesty engine holds up against devtools.

## Troubleshooting

- **Build fails on Vercel** → open the build log; the usual suspect is a missing env var
  (both must exist in Vercel → Settings → Environment Variables; redeploy after adding).
- **"Refusing to run: set a strong ENCRYPTION_KEY"** → that's the safety guard doing its job;
  set the real key in Vercel and redeploy.
- **`db:push` can't connect** → Neon free tier pauses idle databases; just retry (first
  request wakes it), and check the URL ends with `?sslmode=require`.
- **Everyone got signed out** → the `ENCRYPTION_KEY` changed. That's expected behavior.
- **Code runner slow at class scale** → it's Compiler Explorer's shared free API; the
  upgrade path is self-hosting Piston in Docker and setting `PISTON_URL`.
- Anything else: paste the error to Claude — the logs (Vercel → Deployments → your deploy →
  Functions) say exactly what broke.
