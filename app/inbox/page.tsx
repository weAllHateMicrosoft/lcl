import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Inbox from "@/components/messaging/Inbox";

export default async function InboxPage() {
  const me = await currentUser();
  if (!me) redirect("/join");
  return (
    <div className="main" style={{ maxWidth: 1000 }}>
      <div className="crumb">MESSAGES</div>
      <h1 className="title" style={{ marginBottom: 16 }}>Inbox</h1>
      <Inbox meId={me.id} />
    </div>
  );
}
