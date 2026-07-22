import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateFlow, verifyFlow, type Flow } from "@/lib/curriculum/flow";

// Flow authoring import (admin). The anti-hallucination gate: a pasted flow is
// (1) structurally validated, then (2) every verifiable snippet is compiled and
// RUN through the real Java runner, checking the authored claims (predict's
// correct option, fix/write solutions, arrange order, fill chips, tweak
// originals). Only a fully-passing flow is written. Steps carrying `skills`
// get tagged so their answers feed mastery + the overseer.
//
// POST { lessonCode, flow, skipVerify? } → { ok, results, failures } (+written)
// GET  ?lessonCode → the current flow (for re-editing)

export async function GET(req: Request) {
  const me = await requireRoleApi("ADMIN");
  if (me instanceof NextResponse) return me;
  const lessonCode = new URL(req.url).searchParams.get("lessonCode") || "";
  const lesson = await prisma.lesson.findUnique({ where: { code: lessonCode }, select: { flow: true } });
  return NextResponse.json({ flow: lesson?.flow ?? null });
}

export async function POST(req: Request) {
  const me = await requireRoleApi("ADMIN");
  if (me instanceof NextResponse) return me;
  const { lessonCode, flow, skipVerify } = (await req.json()) as { lessonCode: string; flow: Flow; skipVerify?: boolean };

  const lesson = await prisma.lesson.findUnique({ where: { code: String(lessonCode || "") } });
  if (!lesson) return NextResponse.json({ ok: false, failures: [`no lesson with code "${lessonCode}"`] });

  const v = validateFlow(flow);
  if (!v.ok) return NextResponse.json({ ok: false, failures: v.errors });

  let results: string[] = [];
  if (!skipVerify) {
    const check = await verifyFlow(flow);
    results = check.results;
    if (!check.ok) return NextResponse.json({ ok: false, results, failures: check.failures });
  }

  // Strip server-side-only authoring fields we don't want stored twice? No —
  // store the flow whole (solutions included); the GET/lesson route strips.
  await prisma.lesson.update({ where: { id: lesson.id }, data: { flow: flow as any } });

  // Skill tagging: step.skills = ["statement", ...] → find-or-create on this
  // lesson (AI-origin until confirmed in /admin/skills) + tag the step id.
  let tagged = 0;
  const existing = await prisma.skill.findMany({ where: { lessonId: lesson.id } });
  for (const step of flow.steps) {
    for (const stmt of step.skills || []) {
      const clean = String(stmt).trim();
      if (!clean) continue;
      let skill = existing.find((s) => s.statement.toLowerCase() === clean.toLowerCase());
      if (!skill) {
        skill = await prisma.skill.create({ data: { lessonId: lesson.id, statement: clean, origin: "ai", confidence: 0.6 } });
        existing.push(skill);
      }
      await prisma.questionSkill.upsert({
        where: { questionId_skillId: { questionId: step.id, skillId: skill.id } },
        create: { questionId: step.id, skillId: skill.id, origin: "ai" },
        update: {},
      });
      tagged++;
    }
  }

  return NextResponse.json({ ok: true, written: true, steps: flow.steps.length, tagged, results });
}
