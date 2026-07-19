import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

// GET whole curriculum tree (for the editor + export).
export async function GET() {
  await requireRole("ADMIN");
  const chapters = await prisma.chapter.findMany({
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ chapters });
}

// PUT saves one lesson's editable fields (autosave from the editor).
export async function PUT(req: Request) {
  await requireRole("ADMIN");
  const { code, title, goal, blocks, exercise, quizBank } = await req.json();
  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (goal !== undefined) data.goal = goal;
  if (blocks !== undefined) data.blocks = blocks;
  if (exercise !== undefined) data.exercise = exercise;
  if (quizBank !== undefined) data.quizBank = quizBank;

  const lesson = await prisma.lesson.update({ where: { code }, data });
  return NextResponse.json({ ok: true, lesson });
}
