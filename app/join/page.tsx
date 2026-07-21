import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import JoinForm from "@/components/JoinForm";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import PracticeButton from "@/components/PracticeButton";

export default async function JoinPage() {
  const me = await currentUser();
  if (me) redirect(me.role === "STUDENT" ? "/lessons" : "/teacher");

  return (
    <div className="authwrap">
      <div className="panel authcard">
        <div className="crumb">START LEARNING</div>
        <h1 className="title" style={{ fontSize: 28, marginBottom: 6 }}>
          Practice Java
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: 14, fontSize: 14 }}>
          Lessons, an AI tutor, and a private coach that remembers your progress — no account required.
        </p>
        <PracticeButton />

        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 13.5 }}>Have a class code?</summary>
          <div style={{ marginTop: 12 }}>
            <GoogleSignInButton label="Continue with Google" />
            <div className="orsep"><span>or use a class code</span></div>
            <JoinForm />
          </div>
        </details>

        <div className="authalt">
          Already have an account? <Link href="/login">Sign in →</Link>
        </div>
      </div>
    </div>
  );
}
