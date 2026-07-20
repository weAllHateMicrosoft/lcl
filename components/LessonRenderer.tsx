import type { Block } from "@/lib/curriculum/blocks";
import LessonQuizBlock from "./lesson/LessonQuizBlock";

// The single renderer for lesson content — used by the student reader AND the
// editor's live preview. When `lessonCode` is passed (student reader), inline
// quiz blocks are interactive; without it (editor preview), they show a summary.
export default function LessonRenderer({ blocks, lessonCode }: { blocks: Block[]; lessonCode?: string }) {
  return (
    <div className="lesson-body">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} lessonCode={lessonCode} />
      ))}
    </div>
  );
}

function BlockView({ block: b, lessonCode }: { block: Block; lessonCode?: string }) {
  switch (b.type) {
    case "heading":
      return <h2>{b.text}</h2>;
    case "prose":
      return <p dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "code":
      return (
        <div className="codeblock">
          <pre>{b.code}</pre>
          {b.out !== undefined && b.out !== "" && (
            <div className="out">
              <span className="lbl">OUTPUT</span>
              {b.out}
            </div>
          )}
        </div>
      );
    case "callout": {
      const icon = b.kind === "mistake" ? "⚠" : b.kind === "tip" ? "✓" : "◆";
      return (
        <div className={`callout ${b.kind}`}>
          <div className="ch">
            {icon} {b.title}
          </div>
          <p dangerouslySetInnerHTML={{ __html: b.html }} />
        </div>
      );
    }
    case "terms":
      return (
        <div className="terms">
          {b.items.map(([k, v], i) => (
            <div className="row" key={i}>
              <div className="k">{k}</div>
              <div className="v" dangerouslySetInnerHTML={{ __html: v }} />
            </div>
          ))}
        </div>
      );
    case "check":
      return (
        <div className="check">
          {b.items.map(([q, a], i) => (
            <details key={i}>
              <summary dangerouslySetInnerHTML={{ __html: q }} />
              <div className="ans" dangerouslySetInnerHTML={{ __html: a }} />
            </details>
          ))}
        </div>
      );
    case "exercise":
      return (
        <div className="tryit">
          <div className="ch">✎ Try it</div>
          <p dangerouslySetInnerHTML={{ __html: b.html }} />
          {b.meta && <div className="meta">{b.meta}</div>}
        </div>
      );
    case "quiz":
      return lessonCode ? (
        <LessonQuizBlock lessonCode={lessonCode} blockId={b.id} title={b.title} questions={b.questions as any} />
      ) : (
        <div className="tryit" style={{ borderColor: "var(--accent-2)" }}>
          <div className="ch" style={{ color: "var(--accent-2)" }}>📝 {b.title || "Quiz"}</div>
          <div className="meta">{b.questions.length} question{b.questions.length === 1 ? "" : "s"} — interactive for students</div>
        </div>
      );
    default:
      return null;
  }
}
