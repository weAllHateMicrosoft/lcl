import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import Forbidden from "@/components/Forbidden";
import TestGrader from "@/components/teacher/TestGrader";

export default async function TestResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "TEACHER" && me.role !== "ADMIN") return <Forbidden need="Teacher" />;
  const test = await prisma.test.findUnique({ where: { id }, select: { classId: true } });
  return (
    <div className="main" style={{ maxWidth: 1000 }}>
      <TestGrader id={id} classId={test?.classId ?? null} />
    </div>
  );
}
