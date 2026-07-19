// The canonical block model. One shape, rendered by <LessonRenderer>, edited by
// the admin CMS. This is what lives in Lesson.blocks (JSON) in the database.

export type Block =
  | { type: "heading"; text: string }
  | { type: "prose"; html: string }
  | { type: "code"; code: string; out?: string }
  | { type: "callout"; kind: "mistake" | "tip" | "note"; title: string; html: string }
  | { type: "terms"; items: [string, string][] }
  | { type: "check"; items: [string, string][] } // concept checks, answer hidden
  | { type: "exercise"; html: string; meta?: string };

export type Exercise = {
  prompt: string;
  starter?: string;
  expected?: string; // expected stdout for output-based grading
  behaviour?: string; // plain-English behaviour for AI grading
  stdin?: string;
};

export type QuizQuestion = {
  q: string;
  opts: string[];
  correct: number; // 0-based
  why?: string;
};

// Prototype lessons use `t:` keys (p/h/code/mistake/tip/note/terms/check/try).
// This normalizes them to the canonical model so we can import the existing
// Unit 2 content straight into the database.
export function fromLegacyBlock(b: any): Block | null {
  switch (b.t) {
    case "p":
      return { type: "prose", html: b.html };
    case "h":
      return { type: "heading", text: b.text };
    case "code":
      return { type: "code", code: b.code, out: b.out };
    case "mistake":
    case "tip":
    case "note":
      return { type: "callout", kind: b.t, title: b.title, html: b.html };
    case "terms":
      return { type: "terms", items: b.items };
    case "check":
      return { type: "check", items: b.items };
    case "try":
      return { type: "exercise", html: b.html, meta: b.meta };
    default:
      return null;
  }
}
