import { canRole } from "@/lib/auth";
import { getLLMConfigForClient } from "@/lib/settings";
import SettingsForm from "@/components/SettingsForm";
import Forbidden from "@/components/Forbidden";

export default async function SettingsPage() {
  if (!(await canRole("ADMIN"))) return <Forbidden need="Admin" />;
  const cfg = await getLLMConfigForClient();
  return (
    <div className="main">
      <h1>AI provider settings</h1>
      <p className="goal">Bring your own key. Swap providers here — no redeploy. The app runs offline (stub) until you add one.</p>
      <SettingsForm initial={cfg} />
    </div>
  );
}
