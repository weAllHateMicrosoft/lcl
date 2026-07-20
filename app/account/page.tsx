import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import ProfileForm from "@/components/account/ProfileForm";
import PasswordForm from "@/components/PasswordForm";
import TotpSetup from "@/components/account/TotpSetup";

export default async function AccountPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (!me.passwordHash) redirect("/lessons");

  return (
    <div className="main" style={{ maxWidth: 720 }}>
      <div className="crumb">YOUR ACCOUNT</div>
      <h1 className="title" style={{ fontSize: 26 }}>{me.name}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 18 }}>{me.email} · {me.role}</p>

      <div className="panel">
        <h2>Profile</h2>
        <ProfileForm initialName={me.name} initialAvatar={me.avatar} />
      </div>

      <div className="panel">
        <h2>Change password</h2>
        <PasswordForm />
      </div>

      {me.role !== "STUDENT" && (
        <div className="panel">
          <h2>Two-factor authentication <span className="tag k">SECURITY</span></h2>
          <TotpSetup enabled={Boolean(me.totpSecret)} />
        </div>
      )}

      {me.role === "ADMIN" && (
        <div className="panel">
          <h2>Accounts</h2>
          <p style={{ fontSize: 14, marginBottom: 10 }}>Manage every user — emails, passwords, locks, 2FA, teachers.</p>
          <Link className="btn" href="/admin/users" style={{ textDecoration: "none" }}>Open account control →</Link>
        </div>
      )}
    </div>
  );
}
