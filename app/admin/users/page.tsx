import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Forbidden from "@/components/Forbidden";
import UserManager from "@/components/admin/UserManager";

export default async function UsersPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "ADMIN") return <Forbidden need="Admin" />;
  return (
    <div className="main" style={{ maxWidth: 1000 }}>
      <div className="crumb">ADMIN · ACCOUNTS</div>
      <h1 className="title" style={{ marginBottom: 6 }}>All accounts</h1>
      <p style={{ color: "var(--muted)", marginBottom: 16 }}>
        Full control: rename, change email, set a new password, unlock, verify, disable 2FA, remove. (Passwords are hashed —
        they can be replaced, never viewed.)
      </p>
      <UserManager meId={me.id} />
    </div>
  );
}
