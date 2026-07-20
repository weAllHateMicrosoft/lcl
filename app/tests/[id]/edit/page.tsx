import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Forbidden from "@/components/Forbidden";
import TestBuilder from "@/components/teacher/TestBuilder";

export default async function EditTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "TEACHER" && me.role !== "ADMIN") return <Forbidden need="Teacher" />;
  return <TestBuilder id={id} />;
}
