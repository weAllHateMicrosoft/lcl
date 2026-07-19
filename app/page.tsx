import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export default async function Home() {
  const me = await currentUser();
  if (!me) redirect("/join");
  redirect(me.role === "STUDENT" ? "/lessons" : "/teacher");
}
