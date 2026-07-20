import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import TestResult from "@/components/student/TestResult";

export default async function TestResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) redirect("/join");
  return (
    <div className="main" style={{ maxWidth: 760 }}>
      <TestResult id={id} />
    </div>
  );
}
