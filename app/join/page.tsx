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
          First time here: enter your class code, your name, your real email, and choose a password. Already joined? <b>Sign in instead.</b>
        </p>
        <JoinForm />
        <div className="authalt">
          Already have an account? <Link href="/login">Sign in →</Link>
        </div>
      </div>
    </div>
  );
}
