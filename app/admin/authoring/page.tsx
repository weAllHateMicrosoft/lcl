import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Forbidden from "@/components/Forbidden";
import AuthoringKit from "@/components/admin/AuthoringKit";
import FlowKit from "@/components/admin/FlowKit";

export default async function AuthoringPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "ADMIN") return <Forbidden need="Admin" />;

  const lessons = (
    await prisma.lesson.findMany({
      where: { chapter: { NOT: { title: { startsWith: "__" } } } },
      orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
      select: { code: true, title: true, flow: true },
    })
  ).map((l) => ({ code: l.code, title: l.title, hasFlow: (((l.flow as any)?.steps as unknown[]) || []).length > 0 }));

  return (
    <div className="main" style={{ maxWidth: 820 }}>
      <div className="crumb">ADMIN · AI AUTHORING</div>
      <h1 className="title" style={{ marginBottom: 8 }}>Build lessons with AI</h1>
      <p style={{ color: "var(--muted)", marginBottom: 18 }}>
        Draft a whole unit in a strong external model (Claude, or Gemini in AI Studio), then paste the JSON back here to add it
        to your curriculum. No API key needed — this is copy-paste.
      </p>
      <AuthoringKit />
      <FlowKit lessons={lessons} />
    </div>
  );
}
