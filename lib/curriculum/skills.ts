import "server-only";
import { prisma } from "@/lib/db";
import { complete } from "@/lib/llm";
import { sanitizeInline, stripHtml } from "@/lib/sanitize";
import { normalizeQuestions, type Question } from "@/lib/curriculum/questions";
import type { Block } from "@/lib/curriculum/blocks";

// The "syllabus builder" (STUDENT-MODEL.md §4.1). Reads a lesson's REAL
// questions and proposes a provisional skill-map — the "revealed curriculum".
// It never authors truth: everything it writes is origin:"ai" for the teacher
// to confirm/rename/merge/split. Teacher-confirmed skills are never clobbered.

// One question flattened to { id, text } for the model + for gap analysis.
export type LessonItem = { id: string; type: string; text: string };

// Gather every gradable question a lesson contains, from all three homes:
// the typed mastery quiz, inline quiz blocks, and the legacy quizBank.
export function gatherLessonItems(lesson: {
  masteryQuiz: unknown;
  quizBank: unknown;
  blocks: unknown;
}): LessonItem[] {
  const items: LessonItem[] = [];
  const push = (qs: Question[]) => {
    for (const q of qs) {
      if (q.type === "info") continue; // ungraded stimulus — no skill evidence
      const opts = q.type === "mcq" ? " | options: " + q.opts.map((o) => stripHtml(o)).join(" / ") : "";
      items.push({ id: q.id, type: q.type, text: stripHtml((q as any).q || "") + opts });
    }
  };
  push(normalizeQuestions((lesson.masteryQuiz as any[]) || []));
  for (const b of (lesson.blocks as unknown as Block[]) || []) {
    if (b.type === "quiz") push(b.questions as Question[]);
  }
  push(normalizeQuestions((lesson.quizBank as any[]) || []));
  // de-dupe by question id (a question could appear in more than one home)
  const seen = new Set<string>();
  return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
}

type AiSkill = { key: string; statement: string; difficulty?: number };
type AiOut = { skills: AiSkill[]; tags: Record<string, string[]> };

/**
 * Analyse one lesson: propose skills, tag its questions, persist as provisional.
 * Replaces only the lesson's origin:"ai" skills (teacher-confirmed ones survive).
 * Returns the full current picture the review UI renders, including gaps.
 */
export async function analyzeLesson(lessonId: string, userId?: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new Error("lesson not found");

  const items = gatherLessonItems(lesson);
  const objectives = ((lesson.objectives as unknown as string[]) || []).filter(Boolean);

  if (items.length === 0) {
    return { skills: [], gaps: { untaggedQuestions: [], emptySkills: [] as string[] }, itemCount: 0, note: "This lesson has no questions yet — nothing to measure against." };
  }

  // Teacher-confirmed skills for this lesson are sacred; we build around them.
  const keptTeacher = await prisma.skill.findMany({ where: { lessonId, origin: "teacher" } });

  const r = await complete<AiOut>(
    {
      feature: "generate",
      system: `You map a lesson's questions to the underlying SKILLS they test — the concrete, checkable things a student must be able to DO. This is a draft for a teacher to confirm; be conservative and concrete, not exhaustive.

Return ONLY JSON: {"skills":[{"key":"s1","statement":"trace a for-loop's variable","difficulty":2}],"tags":{"<questionId>":["s1","s2"]}}
Rules:
- Prefer FEW, coarse skills (roughly one per learning objective). Merge near-duplicates.
- "statement" starts with a verb and names an ability, not a topic ("apply the modulo operator", not "modulo").
- "difficulty" is 1..5 (a hint, not a law).
- "tags" maps each questionId to the skill key(s) it exercises. A question may test more than one; a question may test none (omit it).
- "key" is a short local id you invent (s1, s2, …) used only to wire tags.${objectives.length ? `\n- The teacher already listed these objectives — align your skills to them where they fit: ${objectives.map((o) => `"${o}"`).join(", ")}.` : ""}${keptTeacher.length ? `\n- These skills are ALREADY CONFIRMED by the teacher; reuse them (same wording) instead of inventing near-duplicates, and still tag questions to them: ${keptTeacher.map((s) => `"${s.statement}"`).join(", ")}.` : ""}`,
      messages: [
        {
          role: "user",
          content: `Lesson: ${lesson.title}\nGoal: ${lesson.goal || "(none)"}\n\nQuestions (id — text):\n${items.map((it) => `${it.id} [${it.type}] ${it.text}`).join("\n")}`,
        },
      ],
      json: true,
      maxTokens: 4000,
    },
    { userId }
  );

  const out = r.data;
  if (!out?.skills?.length) {
    return {
      skills: await currentSkillPicture(lessonId),
      gaps: await computeGaps(lessonId, items),
      itemCount: items.length,
      note: r.provider === "stub" ? "No AI key configured — add one in Admin → Settings." : "The model didn't return a usable map. Try re-analysing.",
    };
  }

  // Persist. Wipe this lesson's previous AI suggestions (and their tags via
  // cascade), keep teacher-confirmed skills, then write the fresh proposal.
  await prisma.skill.deleteMany({ where: { lessonId, origin: "ai" } });

  const keyToId = new Map<string, string>();
  for (const s of out.skills) {
    const statement = sanitizeInline(String(s.statement || "").trim());
    if (!statement) continue;
    // If it matches a confirmed skill, reuse that row instead of duplicating.
    const match = keptTeacher.find((k) => k.statement.toLowerCase() === statement.toLowerCase());
    if (match) {
      keyToId.set(s.key, match.id);
      continue;
    }
    const created = await prisma.skill.create({
      data: {
        lessonId,
        statement,
        difficulty: clampDiff(s.difficulty),
        origin: "ai",
        confidence: 0.5,
      },
    });
    keyToId.set(s.key, created.id);
  }

  // Wire tags (origin:"ai"). Only for questions that actually exist in the lesson.
  const validIds = new Set(items.map((i) => i.id));
  for (const [questionId, keys] of Object.entries(out.tags || {})) {
    if (!validIds.has(questionId)) continue;
    for (const key of keys || []) {
      const skillId = keyToId.get(key);
      if (!skillId) continue;
      await prisma.questionSkill.upsert({
        where: { questionId_skillId: { questionId, skillId } },
        create: { questionId, skillId, origin: "ai" },
        update: {},
      });
    }
  }

  return {
    skills: await currentSkillPicture(lessonId),
    gaps: await computeGaps(lessonId, items),
    itemCount: items.length,
    note: null as string | null,
  };
}

// The lesson's skills + how many questions each currently covers.
export async function currentSkillPicture(lessonId: string) {
  const skills = await prisma.skill.findMany({
    where: { lessonId },
    include: { _count: { select: { questionSkills: true } } },
    orderBy: [{ origin: "asc" }, { createdAt: "asc" }],
  });
  return skills.map((s) => ({
    id: s.id,
    statement: s.statement,
    difficulty: s.difficulty,
    origin: s.origin,
    confidence: s.confidence,
    questionCount: s._count.questionSkills,
  }));
}

// Gaps the teacher should see: questions no skill covers, skills no question
// measures. Both are blind spots for the eventual mastery signal.
export async function computeGaps(lessonId: string, items?: LessonItem[]) {
  if (!items) {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    items = lesson ? gatherLessonItems(lesson) : [];
  }
  const tags = await prisma.questionSkill.findMany({
    where: { skill: { lessonId } },
    select: { questionId: true, skillId: true },
  });
  const tagged = new Set(tags.map((t) => t.questionId));
  const skillsWithQ = new Set(tags.map((t) => t.skillId));
  const emptySkills = await prisma.skill.findMany({
    where: { lessonId, id: { notIn: [...skillsWithQ] } },
    select: { id: true, statement: true },
  });
  return {
    untaggedQuestions: items.filter((it) => !tagged.has(it.id)).map((it) => ({ id: it.id, text: it.text.slice(0, 80) })),
    emptySkills: emptySkills.map((s) => s.statement),
  };
}

function clampDiff(d: unknown): number | null {
  const n = Number(d);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(5, Math.round(n)));
}
