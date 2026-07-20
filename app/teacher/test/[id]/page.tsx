import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Forbidden from "@/components/Forbidden";
import TestGrader from "@/components/teacher/TestGrader";

export default async function TestResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "TEACHER" && me.role !== "ADMIN") return <Forbidden need="Teacher" />;
  return (
    <div className="main" style={{ maxWidth: 1000 }}>
      <TestGrader id={id} />
    </div>
  );
}
