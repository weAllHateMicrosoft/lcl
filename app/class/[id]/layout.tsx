import Link from "next/link";
import { authClass } from "@/lib/classauth";
import ClassTabs from "@/components/teacher/ClassTabs";

export default async function ClassLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls } = await authClass(id);

  return (
    <div className="main" style={{ maxWidth: 1000 }}>
      <div className="crumb">
        <Link href="/class" style={{ textDecoration: "underline dotted" }}>MY CLASSES</Link>
        {cls.googleCourseId ? " · 🎓 GOOGLE-LINKED" : ""}
      </div>
      <h1 className="title" style={{ marginBottom: 10 }}>{cls.name}</h1>
      <ClassTabs id={id} />
      <div style={{ marginTop: 18 }}>{children}</div>
    </div>
  );
}
