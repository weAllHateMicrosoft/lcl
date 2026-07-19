import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { complete } from "@/lib/llm";
import { tutorSystem, gradeSystem, generateSystem } from "@/lib/llm/prompts";
import { performanceSummary } from "@/lib/progress";
import { normalize } from "@/lib/text";
import type { Exercise, QuizQuestion } from "@/lib/curriculum/blocks";

export async function POST(req: Request) {
  const body = await req.json();
  const { feature, lessonCode } = body;
  const me = await currentUser();

  const lesson = await prisma.lesson.findUnique({ where: { code: lessonCode } });
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });
  const exercise = lesson.exercise as unknown as Exercise;

  // ─── Tutor ─────────────────────────────────────────────────────────────────
  if (feature === "tutor") {
    const record = await performanceSummary(me.id, lesson.id);
    const r = await complete<never>(
      {
        feature: "tutor",
        system: tutorSystem({ lessonTitle: lesson.title, goal: lesson.goal, exercisePrompt: exercise?.prompt, record }),
        messages: [{ role: "user", content: `Student question: ${body.message}\n\nTheir current code:\n${body.code || "(none)"}` }],
        maxTokens: 400,
      },
      { userId: me.id }
    );
    return NextResponse.json({ text: r.text, meta: metaLine(r) });
  }

  // ─── Grade (output verdict is authoritative; AI writes the coaching) ─────────
  if (feature === "grade") {
    const passed = body.compiled !== false && normalize(body.stdout || "") === normalize(exercise?.expected || "");
    const r = await complete<{ feedback: string }>(
      {
        feature: "grade",
        system: gradeSystem({ prompt: exercise?.prompt || "", behaviour: exercise?.behaviour || "", compileError: body.compiled === false ? body.error : undefined }),
        messages: [{ role: "user", content: `Student code:\n${body.code}\n\n${body.compiled === false ? `Compiler error:\n${body.error}` : `Program output:\n${body.stdout}`}` }],
        json: true,
        maxTokens: 300,
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
        system: generateSystem({ lessonTitle: lesson.title, goal: lesson.goal, record }),
        messages: [{ role: "user", content: body.request ? `Student request: ${body.request}` : "Auto-target the student's weak spots." }],
        json: true,
        maxTokens: 900,
      },
      { userId: me.id }
    );
    let questions = (r.data?.questions || []).filter(
      (q) => q && q.q && Array.isArray(q.opts) && q.opts.length === 4 && Number.isInteger(q.correct)
    );
    let note = `AI-generated (${metaLine(r)})`;
    if (!questions.length) {
      questions = (lesson.quizBank as unknown as QuizQuestion[]).slice(0, 4);
      note = "offline fallback — the lesson's own practice bank";
    }
    return NextResponse.json({ questions, note });
  }

  return NextResponse.json({ error: "unknown feature" }, { status: 400 });
}

function metaLine(r: { provider: string; model: string; usage: { input: number; output: number }; cost: number }) {
  return `${r.provider}/${r.model} · ${r.usage.input}in/${r.usage.output}out · $${r.cost.toFixed(5)}`;
}
