import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Forbidden from "@/components/Forbidden";
import AuthoringKit from "@/components/admin/AuthoringKit";

export default async function AuthoringPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "ADMIN") return <Forbidden need="Admin" />;
  return (
    <div className="main" style={{ maxWidth: 820 }}>
      <div className="crumb">ADMIN · AI AUTHORING</div>
      <h1 className="title" style={{ marginBottom: 8 }}>Build lessons with AI</h1>
      <p style={{ color: "var(--muted)", marginBottom: 18 }}>
        Draft a whole unit in a strong external model (Claude, or Gemini in AI Studio), then paste the JSON back here to add it
        to your curriculum. No API key needed — this is copy-paste.
      </p>
      <AuthoringKit />
    </div>
  );
}
