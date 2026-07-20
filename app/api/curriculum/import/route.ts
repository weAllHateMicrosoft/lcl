import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth";

// Import curriculum JSON. Shape: { chapters: [...], mode?: "append" | "replace" }.
// - "append" (default): add these chapters/lessons alongside existing ones;
//   colliding lesson codes get a "-2" suffix. Nothing is deleted.
// - "replace": wipe everything first (attempts/progress too). Used by the
//   editor's Import (which warns first).
export async function POST(req: Request) {
  const gate = await requireRoleApi("ADMIN");
  if (gate instanceof NextResponse) return gate;
  const body = await req.json();
  const chapters = body.chapters;
  const mode = body.mode === "replace" ? "replace" : "append";
  if (!Array.isArray(chapters)) return NextResponse.json({ error: "expected { chapters: [] }" }, { status: 400 });

  let added = 0;
  await prisma.$transaction(async (tx) => {
    if (mode === "replace") {
      await tx.attempt.deleteMany();
      await tx.progress.deleteMany();
      await tx.lesson.deleteMany();
      await tx.chapter.deleteMany();
    }

    const used = new Set((await tx.lesson.findMany({ select: { code: true } })).map((l) => l.code));
    const chapCount = await tx.chapter.count();

    for (let ci = 0; ci < chapters.length; ci++) {
      const c = chapters[ci];
      const chapter = await tx.chapter.create({ data: { order: c.order ?? chapCount + ci + 1, title: c.title || "Untitled chapter" } });
      const lessons = c.lessons || [];
      for (let li = 0; li < lessons.length; li++) {
        const l = lessons[li];
        let code = String(l.code || `${ci}.${li}`);
        while (used.has(code)) code = `${code}-2`;
        used.add(code);
        await tx.lesson.create({
          data: {
            chapterId: chapter.id,
            code,
            order: l.order ?? li,
            title: l.title || "Untitled lesson",
            goal: l.goal || "",
            objectives: l.objectives ?? undefined,
            blocks: l.blocks ?? [],
            exercise: l.exercise ?? {},
            quizBank: l.quizBank ?? [],
            masteryQuiz: l.masteryQuiz ?? undefined,
          },
        });
        added++;
      }
    }
  });

  return NextResponse.json({ ok: true, added, mode });
}
