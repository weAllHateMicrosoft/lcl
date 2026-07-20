import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const me = await currentUser();
  if (me) redirect(me.role === "STUDENT" ? "/lessons" : "/teacher");

  return (
    <div className="authwrap">
      <div className="panel authcard">
        <div className="crumb">SIGN IN</div>
        <h1 className="title" style={{ fontSize: 28, marginBottom: 14 }}>
          Welcome back
        </h1>
        <LoginForm />
        <div className="authalt">
          New student? <Link href="/join">Join your class with a code →</Link>
        </div>
      </div>
    </div>
  );
}
