import type { Block } from "@/lib/curriculum/blocks";

// The single renderer for lesson content. The student reader and the admin
// editor's live preview both use this — one source of truth for how a lesson
// looks. (HTML in prose/callout comes from the trusted CMS, authored by staff.)
export default function LessonRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="lesson-body">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}

function BlockView({ block: b }: { block: Block }) {
  switch (b.type) {
    case "heading":
      return <h2>{b.text}</h2>;
    case "prose":
      return <p dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "code":
      return (
        <>
          <pre className="codeblock">{b.code}</pre>
          {b.out !== undefined && b.out !== "" && (
            <div className="codeout">
              <span className="lbl">Output</span>
              {b.out}
            </div>
          )}
        </>
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
        <div className="exercise">
          <div className="ch">✎ Exercise</div>
          <p dangerouslySetInnerHTML={{ __html: b.html }} />
          {b.meta && <div className="meta">{b.meta}</div>}
        </div>
      );
    default:
      return null;
  }
}
