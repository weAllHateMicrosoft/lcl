import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import ProfileForm from "@/components/account/ProfileForm";
import PasswordForm from "@/components/PasswordForm";
import StaffManager from "@/components/admin/StaffManager";

export default async function AccountPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (!me.passwordHash) redirect("/lessons"); // students have no account to manage

  const staff = me.role === "ADMIN"
    ? await prisma.user.findMany({ where: { role: { in: ["ADMIN", "TEACHER"] } }, orderBy: [{ role: "asc" }, { name: "asc" }] })
    : [];

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

      {me.role === "ADMIN" && <StaffManager staff={staff.map((s) => ({ id: s.id, name: s.name, email: s.email, role: s.role }))} meId={me.id} />}
    </div>
  );
}
