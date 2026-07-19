"use client";

import dynamic from "next/dynamic";
import { java } from "@codemirror/lang-java";

// CodeMirror uses browser-only APIs — load it client-side only to avoid SSR errors.
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className="cm-wrap" style={{ height: 160, background: "#1c2230" }} />,
});

export default function CodeEditor({
  value,
  onChange,
  height = "160px",
}: {
  value: string;
  onChange: (v: string) => void;
  height?: string;
}) {
  return (
    <div className="cm-wrap">
      <CodeMirror
        value={value}
        height={height}
        theme="dark"
        extensions={[java()]}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
      />
    </div>
  );
}
