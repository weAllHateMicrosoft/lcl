import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const G_MSG: Record<string, string> = {
  nostudent: "That Google account isn't in a class yet. Ask your teacher to add you, or join with a class code.",
  denied: "Google sign-in was cancelled.",
  badstate: "Sign-in expired — please try again.",
  error: "Google sign-in failed — try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const me = await currentUser();
  if (me) redirect(me.role === "STUDENT" ? "/lessons" : "/teacher");
  const { google } = await searchParams;

  return (
    <div className="authwrap">
      <div className="panel authcard">
        <div className="crumb">SIGN IN</div>
        <h1 className="title" style={{ fontSize: 28, marginBottom: 14 }}>
          Welcome back
        </h1>
        {google && G_MSG[google] && <div className="offline-note" style={{ marginBottom: 12 }}>{G_MSG[google]}</div>}

        <GoogleSignInButton />
        <div className="orsep"><span>or</span></div>

        <LoginForm />
        <div className="authalt">
          New student? <Link href="/join">Join your class with a code →</Link>
        </div>
      </div>
    </div>
  );
}
