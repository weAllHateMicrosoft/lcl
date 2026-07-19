import type { Block } from "@/lib/curriculum/blocks";

// The single renderer for lesson content — used by the student reader AND the
// editor's live preview. Styles ported from the prototypes (lesson body +
// editor .pv). HTML in prose/callouts is trusted CMS content authored by staff.
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
    default:
      return null;
  }
}
