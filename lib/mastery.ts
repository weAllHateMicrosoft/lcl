import "server-only";
import { prisma } from "./db";
import { getSetting, setSetting } from "./settings";

// The mastery estimator (STUDENT-MODEL.md §3.3). Turns a student's real answers
// into a per-skill judgement that is ALLOWED TO SAY "I don't know yet".
//
// Design commitments:
//  - Computed from the quiz.answer event log × the current question→skill tags,
//    so it always reflects the latest skill map (re-tagging is retroactive).
//  - Three states, never a bare checkmark: strong / weak / unknown. "unknown"
//    (not enough evidence) is a first-class answer, not a gap.
//  - Every threshold is an ADMIN KNOB (getSetting "mastery"), never buried.

export type MasteryConfig = {
  targetEvidence: number; // evidence (recency-weighted) for full confidence
  minConfidence: number; // below this → "unknown / not assessed"
  strongAt: number; // estimate at/above this (when confident) → "strong"
  halfLifeDays: number; // how fast old evidence decays
};

export const DEFAULT_MASTERY: MasteryConfig = {
  targetEvidence: 3,
  minConfidence: 0.5,
  strongAt: 0.75,
  halfLifeDays: 21,
};

export async function getMasteryConfig(): Promise<MasteryConfig> {
  const saved = await getSetting<Partial<MasteryConfig>>("mastery", {});
  return { ...DEFAULT_MASTERY, ...saved };
}
export async function saveMasteryConfig(c: Partial<MasteryConfig>): Promise<void> {
  const merged = { ...DEFAULT_MASTERY, ...(await getSetting<Partial<MasteryConfig>>("mastery", {})), ...c };
  await setSetting("mastery", merged);
}

export type SkillState = "strong" | "weak" | "unknown";
export type SkillMastery = {
  skillId: string;
  statement: string;
  state: SkillState;
  estimate: number; // 0..1 (meaningful only when state !== "unknown")
  confidence: number; // 0..1
  n: number; // raw evidence count
};

type Answer = { correct: boolean; at: Date; difficulty: number };

// One skill's judgement from its evidence. Pure + legible on purpose.
export function estimateSkill(answers: Answer[], cfg: MasteryConfig, statement = "", skillId = ""): SkillMastery {
  if (answers.length === 0) {
    return { skillId, statement, state: "unknown", estimate: 0, confidence: 0, n: 0 };
  }
  const now = Date.now();
  const HL = cfg.halfLifeDays * 24 * 3600 * 1000;
  let wSum = 0; // Σ recency·difficulty weights
  let wCorrect = 0; // Σ weights on correct answers
  let recencyMass = 0; // Σ recency weights (drives confidence)
  for (const a of answers) {
    const recency = Math.pow(0.5, (now - a.at.getTime()) / HL); // 1 fresh → 0 old
    const diffW = Math.max(1, a.difficulty || 1); // harder items count more
    wSum += recency * diffW;
    if (a.correct) wCorrect += recency * diffW;
    recencyMass += recency;
  }
  const estimate = wSum > 0 ? wCorrect / wSum : 0;
  const confidence = Math.min(1, recencyMass / Math.max(0.001, cfg.targetEvidence));

  let state: SkillState;
  if (confidence < cfg.minConfidence) state = "unknown"; // honest: not enough recent evidence
  else if (estimate >= cfg.strongAt) state = "strong";
  else state = "weak";

  return { skillId, statement, state, estimate, confidence, n: answers.length };
}

// Build the (questionId → {skillId, statement, difficulty}[]) map for a set of
// skills, so we can fan a single answer out to every skill it exercises.
async function tagMap(where: any) {
  const skills = await prisma.skill.findMany({ where, include: { questionSkills: true } });
  const byQuestion = new Map<string, { skillId: string; statement: string; difficulty: number }[]>();
  for (const s of skills) {
    for (const qs of s.questionSkills) {
      const arr = byQuestion.get(qs.questionId) || [];
      arr.push({ skillId: s.id, statement: s.statement, difficulty: s.difficulty || 1 });
      byQuestion.set(qs.questionId, arr);
    }
  }
  return { skills, byQuestion };
}

// A student's mastery across a scope of skills (default: all lesson skills).
export async function studentMastery(userId: string, opts: { lessonId?: string } = {}): Promise<SkillMastery[]> {
  const cfg = await getMasteryConfig();
  const { skills, byQuestion } = await tagMap(opts.lessonId ? { lessonId: opts.lessonId } : { lessonId: { not: null } });
  if (skills.length === 0) return [];

  // Every graded answer this student has given (item-level event log).
  const events = await prisma.event.findMany({
    where: { userId, type: "quiz.answer" },
    orderBy: { at: "desc" },
    select: { at: true, payload: true },
  });

  const bySkill = new Map<string, Answer[]>();
  for (const ev of events) {
    const p = ev.payload as any;
    const tags = byQuestion.get(p?.questionId);
    if (!tags) continue;
    for (const t of tags) {
      const arr = bySkill.get(t.skillId) || [];
      arr.push({ correct: !!p.correct, at: ev.at, difficulty: t.difficulty });
      bySkill.set(t.skillId, arr);
    }
  }

  return skills
    .map((s) => estimateSkill(bySkill.get(s.id) || [], cfg, s.statement, s.id))
    .sort((a, b) => rank(a.state) - rank(b.state) || b.confidence - a.confidence);
}

// order weak → unknown → strong so a teacher's eye lands on trouble first
const rank = (s: SkillState) => (s === "weak" ? 0 : s === "unknown" ? 1 : 2);

// Roll a set of skill judgements up into one headline for a lesson/student.
export function rollup(skills: SkillMastery[]): { strong: number; weak: number; unknown: number; total: number } {
  const r = { strong: 0, weak: 0, unknown: 0, total: skills.length };
  for (const s of skills) r[s.state]++;
  return r;
}
