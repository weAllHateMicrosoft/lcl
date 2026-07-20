# Working on classOS by yourself (no money, quota-limited)

You don't need me for everything. This is how to keep moving when your Claude quota is out,
using free tools, even without strong coding skills. Read it once; keep it open while you work.

## The two things to install (free, 20 min)

1. **VS Code** (code.visualstudio.com) — the editor. Free.
2. You already have **Node** and the repo. To run the site on your own computer:
   ```bash
   cd ~/Documents/GitHub/lcl
   npm run dev
   ```
   Open http://localhost:3000. Edit a file, save, the page reloads. This is your workshop —
   changes here do NOT affect the live site until you `git push`.

> ⚠️ Your local `.env` points at the **live Neon database**. Editing content locally edits it
> for real students. That's fine for small edits, but **never run `npm run db:reset`** (it wipes
> everything). If you want a safe sandbox, ask me once to set up a separate dev database.

## Free AI helpers to replace me

You have no money, so use these free tiers. All are good enough for this codebase:

| Tool | Free? | Best for |
|---|---|---|
| **Google AI Studio** (aistudio.google.com) | Yes, generous | pasting a file + asking "change X"; the same Gemini you use in the app |
| **GitHub Copilot** | Free for students (GitHub Student Pack) | autocomplete inside VS Code — apply for the pack with your school email |
| **Gemini Code Assist** in VS Code | Free tier | in-editor chat about your open file |
| **Cursor / Windsurf** free tier | Limited | whole-project AI editing like I do |

**The reliable loop with Google AI Studio (works today, zero setup):**
1. Open the file you want to change in VS Code (e.g. `app/globals.css`).
2. Copy the whole file.
3. In AI Studio, paste it and say exactly what you want: *"This is my CSS. Add a dark mode
   using a `[data-theme='dark']` selector on `:root`, overriding the paper/ink colors. Give me
   the full file back."*
4. Paste the result back over the file. Save. Check `npm run dev`.
5. If it breaks, copy the **red error text** from the terminal back into AI Studio and say "this
   broke, here's the error." Repeat. This is 80% of what I do.

## The one habit that keeps you safe: always build before you push

After any change, run:
```bash
npm run build
```
If it says **"Compiled successfully"**, you're safe to ship. If it shows an error, paste that
error into your AI helper. **Never `git push` on a failed build** — that's what breaks the live
site. (This single check has caught real bugs every time in our sessions.)

To ship a working change:
```bash
git add -A
git commit -m "what you changed"
git push
```
Vercel rebuilds automatically (~2 min). Watch it in the Vercel dashboard → Deployments.

## Where to make common changes (from ARCHITECTURE.md)

- **Colors / spacing / dark mode** → `app/globals.css` (search the `/* ─── section ─── */` headers)
- **Wording on a page** → the matching file in `app/`
- **What the AI tutor says / its personality** → `lib/llm/prompts.ts`
- **A new question type** → `lib/curriculum/questions.ts` + `QuestionView` + `QuestionEditor` + `lib/grading.ts`
- **Add a setting** → it usually lives in the `Setting` table via `lib/settings.ts`

## Good first solo projects (easy → harder)

1. **Change the tutor's tone** — edit the sentences in `lib/llm/prompts.ts`. No risk, instant payoff.
2. **Dark mode** — CSS only, the AI-Studio loop above handles it. Great practice.
3. **Reword/retitle pages** — find text in `app/`, change it.
4. **A new lesson objective or lesson** — no code at all, do it in the app's Editor.
5. **Add a student setting** (font size) — this one touches a few files; do it with AI help and
   `npm run build` after each step.

## When to come back to me

Save your quota for the things that are genuinely hard or risky: database schema changes,
security, anything touching auth or grading integrity, or a feature that spans many files (like
the test system). Bring me a clear list — I work fastest when you batch requests like you've
been doing.

## If something goes wrong

- Live site broken? In Vercel → Deployments, find the last green one, click **⋯ → Promote to
  Production** (instant rollback). Then fix locally and push again.
- Lost in the code? Ask your AI helper: *"In this Next.js project, which file handles \<thing\>?"*
  and paste `ARCHITECTURE.md`.
