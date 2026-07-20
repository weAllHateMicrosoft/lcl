import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { complete } from "@/lib/llm";
import { tutorSystem, gradeSystem, generateSystem } from "@/lib/llm/prompts";
import { performanceSummary } from "@/lib/progress";
import { normalize } from "@/lib/text";
import { sanitizeInline } from "@/lib/sanitize";
import { rateLimit } from "@/lib/ratelimit";
import type { Exercise, QuizQuestion } from "@/lib/curriculum/blocks";

const STUDENT_DAILY_AI_CAP = 150;

export async function POST(req: Request) {
  const body = await req.json();
  const { feature, lessonCode } = body;
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  // One student can't burn the whole class's free-tier quota.
  if (me.role === "STUDENT") {
    if (!rateLimit(`ai:${me.id}`, 15, 60 * 1000)) {
      return NextResponse.json({ error: "Slow down a little — try again in a minute." }, { status: 429 });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const used = await prisma.aiCall.count({ where: { userId: me.id, createdAt: { gte: today } } });
    if (used >= STUDENT_DAILY_AI_CAP) {
      return NextResponse.json({ error: "You've hit today's AI limit — back tomorrow. The lessons and code runner still work!" }, { status: 429 });
    }
  }

  const lesson = await prisma.lesson.findUnique({ where: { code: lessonCode } });
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });
  const exercise = lesson.exercise as unknown as Exercise;
  const objectives = ((lesson.objectives as unknown as string[]) || []).join("; ") || undefined;

  // ─── Tutor ─────────────────────────────────────────────────────────────────
  if (feature === "tutor") {
    const record = await performanceSummary(me.id, lesson.id);
    const r = await complete<never>(
      {
        feature: "tutor",
        system: tutorSystem({ lessonTitle: lesson.title, goal: lesson.goal, objectives, exercisePrompt: exercise?.prompt, record }),
        messages: [{ role: "user", content: `Student question: ${body.message}\n\nTheir current code:\n${body.code || "(none)"}` }],
        // Generous: thinking models (e.g. Gemini flash) spend hidden reasoning
        // tokens inside this budget — a tight cap strangles the visible reply.
        maxTokens: 3000,
      },
      { userId: me.id }
    );
    return NextResponse.json({ text: r.text, meta: metaLine(r) });
  }

  // ─── Grade (output verdict is authoritative; AI writes the coaching) ─────────
  if (feature === "grade") {
    const passed = body.compiled !== false && normalize(body.stdout || "") === normalize(exercise?.expected || "");

    // Rule-based mode: same verdict, zero AI calls, deterministic feedback.
    if (body.mode !== "ai") {
      const feedback =
        body.compiled === false
          ? "The program didn't compile — read the error above, fix that line, and run again."
          : passed
            ? "Output matches the expected result exactly."
            : "Output doesn't match — compare the two boxes above, character by character (spaces and line breaks count).";
      return NextResponse.json({ passed, feedback, meta: "rule-based · output comparison · no AI call" });
    }

    const r = await complete<{ feedback: string }>(
      {
        feature: "grade",
        system: gradeSystem({ prompt: exercise?.prompt || "", behaviour: exercise?.behaviour || "", compileError: body.compiled === false ? body.error : undefined }),
        messages: [{ role: "user", content: `Student code:\n${body.code}\n\n${body.compiled === false ? `Compiler error:\n${body.error}` : `Program output:\n${body.stdout}`}` }],
        json: true,
        maxTokens: 3000,
      },
      { userId: me.id }
    );
    return NextResponse.json({ passed, feedback: r.data?.feedback || r.text, meta: metaLine(r) });
  }

  // ─── Generate practice (fall back to the lesson's own quizBank) ──────────────
  if (feature === "generate") {
    const record = await performanceSummary(me.id, lesson.id);
    const r = await complete<{ questions: QuizQuestion[] }>(
      {
        feature: "generate",
        system: generateSystem({ lessonTitle: lesson.title, goal: lesson.goal, objectives, record }),
        messages: [{ role: "user", content: body.request ? `Student request: ${body.request}` : "Auto-target the student's weak spots." }],
        json: true,
        maxTokens: 8000,
      },
      { userId: me.id }
    );
    // Coerce `correct` (models often return it as a string) then keep any
    // well-formed MCQ (2–6 options, valid answer index).
    let questions: QuizQuestion[] = (r.data?.questions || [])
      .map((q) => ({ ...q, correct: Number(q.correct) }))
      .filter(
        (q) =>
          q && q.q && Array.isArray(q.opts) && q.opts.length >= 2 && q.opts.length <= 6 && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.opts.length
      )
      // AI output is semi-trusted: allow only simple formatting tags, nothing executable.
      .map((q) => ({ ...q, q: sanitizeInline(q.q), opts: q.opts.map(sanitizeInline), why: q.why ? sanitizeInline(q.why) : q.why }));
    let note = `AI-generated live (${metaLine(r)})`;
    if (!questions.length) {
      // Never fail silently: fall back to the lesson bank if it has one, and
      // say exactly what the model returned so failures are debuggable.
      questions = (lesson.quizBank as unknown as QuizQuestion[]).slice(0, 4);
      note =
        r.provider === "stub"
          ? "no AI key configured"
          : `model reply wasn't a valid question set — raw start: "${(r.text || "(empty)").slice(0, 140)}"`;
    }
    return NextResponse.json({ questions, note, provider: r.provider });
  }

  return NextResponse.json({ error: "unknown feature" }, { status: 400 });
}

function metaLine(r: { provider: string; model: string; usage: { input: number; output: number }; cost: number }) {
  return `${r.provider}/${r.model} · ${r.usage.input}in/${r.usage.output}out · $${r.cost.toFixed(5)}`;
}
