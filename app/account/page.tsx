import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import PasswordForm from "@/components/PasswordForm";

export default async function AccountPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (!me.passwordHash) redirect("/lessons"); // students have no password to manage

  return (
    <div className="main" style={{ maxWidth: 560 }}>
      <div className="crumb">YOUR ACCOUNT</div>
      <h1 className="title" style={{ fontSize: 26 }}>{me.name}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 18 }}>
        {me.email} · {me.role}
      </p>
      <div className="panel">
        <h2>Change password</h2>
        <PasswordForm />
      </div>
    </div>
  );
}
