import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import JoinForm from "@/components/JoinForm";

export default async function JoinPage() {
  const me = await currentUser();
  if (me) redirect(me.role === "STUDENT" ? "/lessons" : "/teacher");

  return (
    <div className="authwrap">
      <div className="panel authcard">
        <div className="crumb">STUDENT ENTRANCE</div>
        <h1 className="title" style={{ fontSize: 28, marginBottom: 6 }}>
          Join your class
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: 14, fontSize: 14 }}>
          Type the class code from the board and your name. Use the <b>same name every time</b> to keep your progress.
        </p>
        <JoinForm />
        <div className="authalt">
          Teacher or admin? <Link href="/login">Staff sign-in →</Link>
        </div>
      </div>
    </div>
  );
}
