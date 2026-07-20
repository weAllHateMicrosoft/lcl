import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import TestTaker from "@/components/student/TestTaker";

export default async function TakeTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) redirect("/join");

  const test = await prisma.test.findUnique({ where: { id } });

  // Safe Exam Browser gate: SEB sends a distinctive UA + a request-hash header.
  if (test?.requireSeb && me.role === "STUDENT") {
    const h = await headers();
    const ua = h.get("user-agent") || "";
    const isSeb = /SEB[/ ]/i.test(ua) || h.has("x-safeexambrowser-requesthash");
    if (!isSeb) {
      const host = h.get("x-forwarded-host") || h.get("host") || "";
      return (
        <div className="examwrap">
          <div className="exambody" style={{ maxWidth: 560 }}>
            <div className="sebbar" style={{ borderRadius: 10 }}>
              <span>🔒 LOCKED TEST</span>
              <span>SAFE EXAM BROWSER REQUIRED</span>
            </div>
            <h1 className="title" style={{ fontSize: 24, marginTop: 18 }}>{test.title}</h1>
            <p style={{ color: "var(--muted)" }}>
              This test must be taken inside <b>Safe Exam Browser</b>, which locks down your computer during the exam.
            </p>
            <ol style={{ margin: "12px 0 16px 20px", lineHeight: 1.9 }}>
              <li>Install Safe Exam Browser if you haven't (safeexambrowser.org).</li>
              <li>Click <b>Launch in SEB</b> below (or download the config and open it).</li>
              <li>SEB opens the test full-screen and locked.</li>
            </ol>
            <div className="runrow">
              <a className="btn orange" href={`sebs://${host}/api/tests/${id}/seb`} style={{ textDecoration: "none" }}>Launch in SEB</a>
              <a className="btn ghost" href={`/api/tests/${id}/seb`} style={{ textDecoration: "none" }}>Download config (.seb)</a>
            </div>
            <p className="meta">If the button does nothing, download the config and double-click it.</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="examwrap">
      <TestTaker id={id} />
    </div>
  );
}
