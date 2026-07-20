import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import TestTaker from "@/components/student/TestTaker";

export default async function TakeTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) redirect("/join");
  return (
    <div className="examwrap">
      <TestTaker id={id} />
    </div>
  );
}
