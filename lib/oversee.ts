import "server-only";
import { prisma } from "@/lib/db";
import { complete } from "@/lib/llm";
import { DEFAULT_PROMPTS, renderPrompt } from "@/lib/llm/prompts";
import { getProviderConfig } from "@/lib/settings";
import { studentMastery, type SkillMastery } from "@/lib/mastery";

// The AI overseer (STUDENT-MODEL.md §4.2): reads ONE student's whole record —
// course plan, unit-by-unit mastery, activity, their literal tutor questions,
// test results — and writes an honest, evidence-cited brief for the teacher
// plus a warm note for the student. Everything it reads is real; when the
// record is thin it must say so instead of judging.

export type InsightPayload = {
  v: number;
  summary: string;
  trend: "improving" | "steady" | "slipping" | "inactive";
  alert: "ok" | "watch" | "help";
  strengths: string[];
  gaps: { skill: string; unit: string; evidence: string }[];
  actions: { label: string; detail: string }[];
  studentMessage: string;
};

const DAY = 24 * 3600 * 1000;

// ─── Context assembly (all real data, formatted for the prompt) ──────────────

// Course plan: units → lessons → objectives. Demo/internal chapters (title
// starting "__") are excluded so the AI reads only the real curriculum.
async function curriculumOutline(): Promise<string> {
  const chapters = await prisma.chapter.findMany({
    where: { NOT: { title: { startsWith: "__" } } },
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" }, select: { code: true, title: true, goal: true, objectives: true } } },
  });
  const lines: string[] = [];
  for (const c of chapters) {
    lines.push(`UNIT: ${c.title}`);
    for (const l of c.lessons) {
      const obj = ((l.objectives as unknown as string[]) || []).filter(Boolean);
      lines.push(`  ${l.code} ${l.title}${l.goal ? ` — ${l.goal}` : ""}`);
      for (const o of obj) lines.push(`     · ${o}`);
    }
  }
  return lines.join("\n");
}

// Mastery grouped by unit/lesson, with the honest "unknown" state kept visible.
async function masteryBlock(userId: string): Promise<{ text: string; skills: SkillMastery[] }> {
  const skills = await studentMastery(userId);
  if (!skills.length) return { text: "(no skills defined yet)", skills };
  // map skillId → lesson code/chapter for unit labels
  const rows = await prisma.skill.findMany({
    where: { id: { in: skills.map((s) => s.skillId) } },
    include: { lesson: { select: { code: true, title: true, chapter: { select: { title: true } } } } },
  });
  const where = new Map(rows.map((r) => [r.id, r.lesson ? `${r.lesson.chapter.title} › ${r.lesson.code} ${r.lesson.title}` : "(unscoped)"]));
  const lines = skills.map((s) => {
    const label = s.state === "unknown" ? `unknown (${s.n} answers — not enough to judge)` : `${s.state} (est ${Math.round(s.estimate * 100)}%, ${s.n} answers)`;
    return `- [${where.get(s.skillId) || "?"}] ${s.statement}: ${label}`;
  });
  return { text: lines.join("\n"), skills };
}

// What they actually did lately, humanized + compact.
async function activityBlock(userId: string): Promise<{ text: string; lastActive: Date | null; eventCount: number }> {
  const since = new Date(Date.now() - 21 * DAY);
  const events = await prisma.event.findMany({
    where: { userId, at: { gte: since } },
    orderBy: { at: "desc" },
    take: 400,
    select: { type: true, at: true, payload: true },
  });
  const subs = await prisma.testSubmission.findMany({
    where: { userId },
    include: { test: { select: { title: true } } },
    orderBy: { submittedAt: "desc" },
    take: 5,
  });

  if (!events.length && !subs.length) return { text: "No activity in the last 3 weeks.", lastActive: null, eventCount: 0 };

  const counts = new Map<string, number>();
  let answers = 0;
  let correct = 0;
  for (const e of events) {
    counts.set(e.type, (counts.get(e.type) || 0) + 1);
    if (e.type === "quiz.answer") {
      answers++;
      if ((e.payload as any)?.correct) correct++;
    }
  }
  const lastActive = events[0]?.at ?? null;
  const lines: string[] = [];
  if (lastActive) lines.push(`Last active: ${Math.round((Date.now() - lastActive.getTime()) / DAY)} day(s) ago.`);
  lines.push(
    `Past 3 weeks: ${counts.get("lesson.view") || 0} lesson views, ${answers} questions answered (${answers ? Math.round((correct / answers) * 100) : 0}% correct), ${counts.get("code.run") || 0} code runs, ${counts.get("tutor.message") || 0} tutor chats.`
  );
  for (const s of subs) {
    lines.push(`Test "${s.test.title}": ${s.finalScore ?? s.autoScore}/${s.maxScore}${s.status === "graded" ? "" : " (awaiting marking)"}.`);
  }
  return { text: lines.join("\n"), lastActive, eventCount: events.length };
}

// Their confusion, in their own words — the richest signal we have.
async function tutorQuestionsBlock(userId: string): Promise<string> {
  const msgs = await prisma.event.findMany({
    where: { userId, type: "tutor.message" },
    orderBy: { at: "desc" },
    take: 6,
    select: { payload: true },
  });
  if (!msgs.length) return "(none)";
  return msgs
    .map((m) => `- "${String((m.payload as any)?.question || "").slice(0, 160)}"`)
    .filter((s) => s.length > 4)
    .join("\n");
}

// ─── Generate + persist ──────────────────────────────────────────────────────

export async function overseeStudent(studentId: string, requestedBy?: string): Promise<{ insight?: InsightPayload; error?: string; id?: string; createdAt?: Date }> {
  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== "STUDENT") return { error: "student not found" };

  const [curriculum, mastery, activity, tutorQs, prompts] = await Promise.all([
    curriculumOutline(),
    masteryBlock(studentId),
    activityBlock(studentId),
    tutorQuestionsBlock(studentId),
    getProviderConfig().then((c) => c.prompts),
  ]);

  const system = renderPrompt(prompts.oversee || DEFAULT_PROMPTS.oversee, {
    student: student.name,
    curriculum,
    mastery: mastery.text,
    activity: activity.text,
    tutorQuestions: tutorQs,
  });

  const r = await complete<InsightPayload>(
    {
      feature: "oversee",
      system,
      messages: [{ role: "user", content: `Write the brief for ${student.name} now. JSON only.` }],
      json: true,
      maxTokens: 2000,
    },
    { userId: requestedBy || studentId }
  );

  const d = r.data;
  if (!d || typeof d.summary !== "string" || !d.studentMessage) {
    return { error: r.provider === "stub" ? "No AI key configured — add one in Settings." : "The model returned an unusable brief — try again." };
  }

  // normalize defensively before storing
  const payload: InsightPayload = {
    v: 1,
    summary: String(d.summary).slice(0, 1200),
    trend: (["improving", "steady", "slipping", "inactive"] as const).includes(d.trend as any) ? d.trend : "steady",
    alert: (["ok", "watch", "help"] as const).includes(d.alert as any) ? d.alert : "ok",
    strengths: (d.strengths || []).slice(0, 4).map((s) => String(s).slice(0, 200)),
    gaps: (d.gaps || []).slice(0, 4).map((g: any) => ({
      skill: String(g?.skill || "").slice(0, 120),
      unit: String(g?.unit || "").slice(0, 120),
      evidence: String(g?.evidence || "").slice(0, 240),
    })),
    actions: (d.actions || []).slice(0, 4).map((a: any) => ({
      label: String(a?.label || "").slice(0, 80),
      detail: String(a?.detail || "").slice(0, 240),
    })),
    studentMessage: String(d.studentMessage).slice(0, 800),
  };

  const row = await prisma.studentInsight.create({
    data: { userId: studentId, classId: student.classId, payload: payload as any, provider: r.provider, model: r.model },
  });
  return { insight: payload, id: row.id, createdAt: row.createdAt };
}

// ─── Read side ───────────────────────────────────────────────────────────────

export type LatestInsight = { payload: InsightPayload; createdAt: Date; stale: boolean } | null;

// Newest brief per student, with an honest staleness flag: stale = the student
// has done things since this brief was written.
export async function latestInsights(userIds: string[]): Promise<Map<string, LatestInsight>> {
  const out = new Map<string, LatestInsight>();
  if (!userIds.length) return out;
  const rows = await prisma.studentInsight.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "desc" },
  });
  const newestEvent = await prisma.event.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _max: { at: true },
  });
  const lastAct = new Map(newestEvent.map((e) => [e.userId as string, e._max.at]));
  for (const id of userIds) out.set(id, null);
  for (const r of rows) {
    if (out.get(r.userId)) continue; // already have the newest
    const last = lastAct.get(r.userId);
    out.set(r.userId, {
      payload: r.payload as unknown as InsightPayload,
      createdAt: r.createdAt,
      stale: !!last && last > r.createdAt,
    });
  }
  return out;
}
