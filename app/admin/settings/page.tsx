import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getLLMConfigForClient } from "@/lib/settings";
import SettingsForm from "@/components/SettingsForm";
import Forbidden from "@/components/Forbidden";

export default async function SettingsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "ADMIN") return <Forbidden need="Admin" />;
  const cfg = await getLLMConfigForClient();
  const { getSmtpConfig } = await import("@/lib/email");
  const smtpCfg = await getSmtpConfig();
  (cfg as any).smtp = smtpCfg ? { host: smtpCfg.host, port: smtpCfg.port, user: smtpCfg.user } : null;
  return (
    <div className="main">
      <div className="crumb">ADMIN · AI PROVIDER</div>
      <h1 className="title" style={{ marginBottom: 6 }}>Settings</h1>
      <p style={{ color: "var(--muted)", marginBottom: 10 }}>
        Bring your own key. Swap providers here — no redeploy. The app runs offline (canned responses) until you add one.
      </p>
      <SettingsForm initial={cfg} />
    </div>
  );
}
