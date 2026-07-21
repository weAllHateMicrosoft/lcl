import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeInline } from "@/lib/sanitize";
import { analyzeLesson, currentSkillPicture, computeGaps } from "@/lib/curriculum/skills";

// The syllabus builder's API (STUDENT-MODEL.md §4.1). Read a lesson's skill-map,
// (re)generate the AI proposal, and curate it. Teacher/admin only.

export async function GET(req: Request) {
  const me = await requireRoleApi("TEACHER", "ADMIN");
  if (me instanceof NextResponse) return me;
  const lessonId = new URL(req.url).searchParams.get("lessonId");
  if (!lessonId) return NextResponse.json({ error: "lessonId required" }, { status: 400 });
  const [skills, gaps] = await Promise.all([currentSkillPicture(lessonId), computeGaps(lessonId)]);
  return NextResponse.json({ skills, gaps });
}

export async function POST(req: Request) {
  const me = await requireRoleApi("TEACHER", "ADMIN");
  if (me instanceof NextResponse) return me;
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "analyze": {
      if (!body.lessonId) return NextResponse.json({ error: "lessonId required" }, { status: 400 });
      const result = await analyzeLesson(body.lessonId, me.id);
      return NextResponse.json(result);
    }

    // Flip an AI suggestion into a teacher-confirmed skill (origin sticks).
    case "confirm": {
      await prisma.skill.update({ where: { id: body.skillId }, data: { origin: "teacher", confidence: 1 } });
      return picture(body.lessonId);
    }

    case "rename": {
      const statement = sanitizeInline(String(body.statement || "").trim());
      if (!statement) return NextResponse.json({ error: "statement required" }, { status: 400 });
      // A teacher edit is a confirmation of ownership.
      await prisma.skill.update({ where: { id: body.skillId }, data: { statement, origin: "teacher" } });
      return picture(body.lessonId);
    }

    // Teacher adds a skill by hand — born confirmed.
    case "add": {
      const statement = sanitizeInline(String(body.statement || "").trim());
      if (!body.lessonId || !statement) return NextResponse.json({ error: "lessonId + statement required" }, { status: 400 });
      await prisma.skill.create({ data: { lessonId: body.lessonId, statement, origin: "teacher", confidence: 1 } });
      return picture(body.lessonId);
    }

    case "delete": {
      await prisma.skill.delete({ where: { id: body.skillId } });
      return picture(body.lessonId);
    }

    // Replace the skills a single question is tagged to (within this lesson).
    case "retag": {
      const { lessonId, questionId, skillIds } = body as { lessonId: string; questionId: string; skillIds: string[] };
      if (!lessonId || !questionId) return NextResponse.json({ error: "lessonId + questionId required" }, { status: 400 });
      await prisma.questionSkill.deleteMany({ where: { questionId, skill: { lessonId } } });
      for (const skillId of skillIds || []) {
        await prisma.questionSkill.create({ data: { questionId, skillId, origin: "teacher" } });
      }
      return picture(lessonId);
    }

    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}

async function picture(lessonId: string) {
  const [skills, gaps] = await Promise.all([currentSkillPicture(lessonId), computeGaps(lessonId)]);
  return NextResponse.json({ skills, gaps });
}
