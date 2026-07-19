import "server-only";
import { prisma } from "./db";
import type { AttemptKind } from "./roles";

/**
 * THE honesty chokepoint. Every attempt in the platform funnels through here.
 *
 * The one rule that must never be bypassed: only a passing SUMMATIVE (locked-
 * down) attempt can set a lesson to MASTERED. Everything else feeds readiness
 * and flags only — it can move NOT_STARTED → IN_PROGRESS, but never to MASTERED.
 */
export async function recordAttempt(input: {
  userId: string;
  lessonId: string;
  kind: AttemptKind;
  passed: boolean;
  score?: number; // 0..1
  detail?: unknown;
}) {
  const { userId, lessonId, kind, passed } = input;
  const score = input.score ?? (passed ? 1 : 0);

  await prisma.attempt.create({
    data: { userId, lessonId, kind, passed, score, detail: (input.detail ?? {}) as any },
  });

  const current = await prisma.progress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  const prevStatus = current?.status ?? "NOT_STARTED";

  // Readiness = smoothed running signal from all non-summative evidence.
  const prevReadiness = current?.readiness ?? 0;
  const readiness = clamp(prevReadiness * 0.7 + score * 0.3);

  let status = prevStatus;
  if (kind === "QUIZ_SUMMATIVE" && passed) {
    status = "MASTERED"; // the ONLY path to mastery
  } else if (prevStatus === "NOT_STARTED") {
    status = "IN_PROGRESS";
  }

  // Simple flags for the teacher dashboard.
  const recentFails = await prisma.attempt.count({
    where: { userId, lessonId, passed: false, createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) } },
  });
  let flag: string | null = current?.flag ?? null;
  if (status !== "MASTERED" && recentFails >= 3) flag = "stuck";
  else if (status === "MASTERED" && readiness > 0.9) flag = "coast";
  else if (status !== "MASTERED") flag = null;

  await prisma.progress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, status, readiness, flag },
    update: { status, readiness, flag },
  });

  return { status, readiness, flag };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Short text summary of a student's record on a lesson, for tutor/generate prompts.
export async function performanceSummary(userId: string, lessonId: string): Promise<string> {
  const attempts = await prisma.attempt.findMany({
    where: { userId, lessonId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  if (!attempts.length) return "No attempts yet on this lesson.";
  const passed = attempts.filter((a) => a.passed).length;
  return `${passed}/${attempts.length} recent attempts passed (${attempts.map((a) => `${a.kind}:${a.passed ? "✓" : "✗"}`).join(", ")}).`;
}
