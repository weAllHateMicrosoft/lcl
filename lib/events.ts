import "server-only";
import { prisma } from "./db";

/**
 * The analytics substrate (STUDENT-MODEL.md §2).
 *
 * Rule: logging must NEVER slow or break a real request. Every write here is
 * best-effort and fire-and-forget — errors are swallowed, not thrown. Nothing
 * in the app should ever `await` a log for correctness; it only feeds later
 * analysis and the derived student model.
 */

// v1 event taxonomy. Namespaced `type` strings — the thing that keeps the log
// organised rather than a junk drawer. Add new ones freely; never repurpose an
// existing one (bump the payload `v` instead).
export const EVENT = {
  LESSON_VIEW: "lesson.view",
  BLOCK_DWELL: "block.dwell",
  QUIZ_ANSWER: "quiz.answer", // the load-bearing one: item-level, everywhere
  CODE_RUN: "code.run",
  TUTOR_MESSAGE: "tutor.message",
  HINT_REVEAL: "hint.reveal",
  TEST_SUBMIT: "test.submit",
  MASTERY_CHANGE: "mastery.change",
} as const;

export type EventType = (typeof EVENT)[keyof typeof EVENT];

type LogInput = {
  type: EventType | string;
  userId?: string | null;
  classId?: string | null;
  // Everything else is payload. A `v` is stamped automatically if absent.
  [k: string]: unknown;
};

/**
 * Record one event. Fire-and-forget: call it without awaiting.
 *
 *   logEvent({ type: EVENT.QUIZ_ANSWER, userId, lessonId, questionId, correct });
 */
export function logEvent({ type, userId, classId, ...payload }: LogInput): void {
  // Never let a logging failure surface to the caller.
  const p = { v: 1, ...payload };
  prisma.event
    .create({ data: { type, userId: userId ?? null, classId: classId ?? null, payload: p as any } })
    .catch(() => {
      /* swallow — analytics must not break the request */
    });
}

/**
 * Awaitable variant, for the rare caller already inside a fire-and-forget
 * context (e.g. a background job) that wants to know it landed. Still never
 * throws.
 */
export async function logEventNow(input: LogInput): Promise<void> {
  try {
    const { type, userId, classId, ...payload } = input;
    await prisma.event.create({
      data: { type, userId: userId ?? null, classId: classId ?? null, payload: { v: 1, ...payload } as any },
    });
  } catch {
    /* swallow */
  }
}
