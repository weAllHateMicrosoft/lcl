import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

// Replace the whole curriculum from a JSON export. Portability = freedom:
// export from one classOS, import into another. Shape: { chapters: [...] }.
export async function POST(req: Request) {
  await requireRole("ADMIN");
  const { chapters } = await req.json();
  if (!Array.isArray(chapters)) return NextResponse.json({ error: "expected { chapters: [] }" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    // Attempts/progress reference lessons — clear them so a fresh import is clean.
    await tx.attempt.deleteMany();
    await tx.progress.deleteMany();
    await tx.lesson.deleteMany();
    await tx.chapter.deleteMany();

    for (let ci = 0; ci < chapters.length; ci++) {
      const c = chapters[ci];
      const chapter = await tx.chapter.create({ data: { order: c.order ?? ci, title: c.title || "Untitled chapter" } });
      const lessons = c.lessons || [];
      for (let li = 0; li < lessons.length; li++) {
        const l = lessons[li];
        await tx.lesson.create({
          data: {
            chapterId: chapter.id,
            code: l.code || `${ci}.${li}`,
            order: l.order ?? li,
            title: l.title || "Untitled lesson",
            goal: l.goal || "",
            blocks: l.blocks ?? [],
            exercise: l.exercise ?? {},
            quizBank: l.quizBank ?? [],
          },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
