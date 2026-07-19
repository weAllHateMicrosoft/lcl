import { canRole } from "@/lib/auth";
import Editor from "@/components/Editor";
import Forbidden from "@/components/Forbidden";

export default async function EditorPage() {
  if (!(await canRole("ADMIN"))) return <Forbidden need="Admin" />;
  return <Editor />;
}
