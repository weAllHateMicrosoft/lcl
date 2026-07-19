import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Editor from "@/components/Editor";
import Forbidden from "@/components/Forbidden";

export default async function EditorPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "ADMIN") return <Forbidden need="Admin" />;
  return <Editor />;
}
