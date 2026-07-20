import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth";

// GET whole curriculum tree (for the editor + export).
export async function GET() {
  const gate = await requireRoleApi("ADMIN");
  if (gate instanceof NextResponse) return gate;
  const chapters = await prisma.chapter.findMany({
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ chapters });
}

// PUT autosaves the DRAFT (never live fields — students keep seeing the last
// published version until the owner hits Publish).
export async function PUT(req: Request) {
  const gate = await requireRoleApi("ADMIN");
  if (gate instanceof NextResponse) return gate;
  const { id, draft, code } = await req.json();
  const data: Record<string, unknown> = { draft, draftAt: new Date() };
  if (code !== undefined) data.code = code; // lesson code is structural, applies immediately
  const lesson = await prisma.lesson.update({ where: { id }, data });
  return NextResponse.json({ ok: true, draftAt: lesson.draftAt });
}

// POST = structural actions from the editor (add/delete/duplicate/rename).
export async function POST(req: Request) {
  const gate = await requireRoleApi("ADMIN");
  if (gate instanceof NextResponse) return gate;
  const body = await req.json();

  switch (body.action) {
    case "addChapter": {
      const count = await prisma.chapter.count();
      const chapter = await prisma.chapter.create({ data: { order: count + 1, title: body.title || "New Chapter" } });
      return NextResponse.json({ ok: true, chapter });
    }
    case "renameChapter": {
      await prisma.chapter.update({ where: { id: body.chapterId }, data: { title: body.title } });
      return NextResponse.json({ ok: true });
    }
    case "addLesson": {
      const count = await prisma.lesson.count({ where: { chapterId: body.chapterId } });
      const lesson = await prisma.lesson.create({
        data: {
          chapterId: body.chapterId,
          code: body.code || `new-${Date.now().toString(36)}`,
          order: count,
          title: "New Lesson",
          goal: "",
          blocks: [],
          exercise: {},
          quizBank: [],
        },
      });
      return NextResponse.json({ ok: true, lesson });
    }
    case "duplicateLesson": {
      const src = await prisma.lesson.findUnique({ where: { id: body.lessonId } });
      if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });
      const lesson = await prisma.lesson.create({
        data: {
          chapterId: src.chapterId,
          code: `${src.code}-copy`,
          order: src.order + 1,
          title: `${src.title} (copy)`,
          goal: src.goal,
          blocks: src.blocks as any,
          exercise: src.exercise as any,
          quizBank: src.quizBank as any,
        },
      });
      return NextResponse.json({ ok: true, lesson });
    }
    case "deleteLesson": {
      await prisma.lesson.delete({ where: { id: body.lessonId } });
      return NextResponse.json({ ok: true });
    }
    case "publish": {
      const l = await prisma.lesson.findUnique({ where: { id: body.lessonId } });
      if (!l || !l.draft) return NextResponse.json({ error: "nothing to publish" }, { status: 400 });
      // Snapshot the outgoing live version first — that's the undo history.
      await prisma.lessonVersion.create({
        data: {
          lessonId: l.id,
          snapshot: { title: l.title, goal: l.goal, objectives: l.objectives, blocks: l.blocks, exercise: l.exercise, quizBank: l.quizBank } as any,
        },
      });
      const d = l.draft as any;
      await prisma.lesson.update({
        where: { id: l.id },
        data: {
          title: d.title ?? l.title,
          goal: d.goal ?? l.goal,
          objectives: d.objectives ?? l.objectives ?? [],
          blocks: d.blocks ?? l.blocks,
          exercise: d.exercise ?? l.exercise,
          quizBank: d.quizBank ?? l.quizBank,
          draft: Prisma.DbNull,
          draftAt: null,
        },
      });
      return NextResponse.json({ ok: true });
    }
    case "discardDraft": {
      await prisma.lesson.update({ where: { id: body.lessonId }, data: { draft: Prisma.DbNull, draftAt: null } });
      return NextResponse.json({ ok: true });
    }
    case "restoreVersion": {
      const v = await prisma.lessonVersion.findUnique({ where: { id: body.versionId } });
      if (!v) return NextResponse.json({ error: "version not found" }, { status: 404 });
      // Restore into the DRAFT so the owner can review before publishing.
      await prisma.lesson.update({ where: { id: v.lessonId }, data: { draft: v.snapshot as any, draftAt: new Date() } });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
