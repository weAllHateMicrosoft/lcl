// String unions standing in for what become Prisma enums on Postgres.
export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export type AttemptKind = "QUIZ_PRACTICE" | "QUIZ_GENERATED" | "CODE_RUN" | "QUIZ_SUMMATIVE";

export const ATTEMPT_KINDS: AttemptKind[] = ["QUIZ_PRACTICE", "QUIZ_GENERATED", "CODE_RUN", "QUIZ_SUMMATIVE"];
