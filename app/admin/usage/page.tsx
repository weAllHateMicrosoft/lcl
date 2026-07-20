import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import Forbidden from "@/components/Forbidden";

// AI usage / budget dashboard (admin). All figures come from the AiCall log.
export default async function UsagePage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "ADMIN") return <Forbidden need="Admin" />;

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [total, recent, byFeature, byModel, byUser, users] = await Promise.all([
    prisma.aiCall.aggregate({ _sum: { cost: true, inTokens: true, outTokens: true }, _count: true }),
    prisma.aiCall.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, cost: true } }),
    prisma.aiCall.groupBy({ by: ["feature"], _sum: { cost: true }, _count: true }),
    prisma.aiCall.groupBy({ by: ["provider", "model"], _sum: { cost: true }, _count: true }),
    prisma.aiCall.groupBy({ by: ["userId"], _sum: { cost: true }, _count: true, orderBy: { _sum: { cost: "desc" } }, take: 10 }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  // bucket last 14 days
  const days: { label: string; cost: number; calls: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, cost: 0, calls: 0 });
  }
  for (const c of recent) {
    const idx = 13 - Math.floor((Date.now() - c.createdAt.getTime()) / 86400000);
    if (idx >= 0 && idx < 14) {
      days[idx].cost += c.cost;
      days[idx].calls += 1;
    }
  }
  const maxCalls = Math.max(1, ...days.map((d) => d.calls));

  return (
    <div className="main" style={{ maxWidth: 900 }}>
      <div className="crumb">ADMIN · AI USAGE</div>
      <h1 className="title" style={{ marginBottom: 16 }}>AI budget</h1>

      <div className="kpis">
        <div className="kpi"><div className="n"><em>${(total._sum.cost || 0).toFixed(4)}</em></div><p>total spend (all time)</p></div>
        <div className="kpi"><div className="n"><em>{total._count}</em></div><p>AI calls</p></div>
        <div className="kpi"><div className="n"><em>{(((total._sum.inTokens || 0) + (total._sum.outTokens || 0)) / 1000).toFixed(0)}k</em></div><p>tokens used</p></div>
      </div>

      <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "20px 0 8px" }}>Last 14 days (calls/day)</h2>
      <div className="panel" style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
        {days.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }} title={`${d.calls} calls · $${d.cost.toFixed(4)}`}>
            <div style={{ width: "70%", background: "var(--accent)", borderRadius: "4px 4px 0 0", height: `${(d.calls / maxCalls) * 100}%`, minHeight: d.calls ? 3 : 0 }} />
            <span style={{ fontSize: 9, color: "var(--muted)", marginTop: 3, fontFamily: "var(--mono)" }}>{d.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "20px 0 8px" }}>By task</h2>
          <div className="dashgrid"><table><tbody>
            {byFeature.map((f) => (
              <tr key={f.feature}><td className="name">{f.feature}</td><td>{f._count} calls</td><td>${(f._sum.cost || 0).toFixed(4)}</td></tr>
            ))}
          </tbody></table></div>
        </div>
        <div>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "20px 0 8px" }}>By model</h2>
          <div className="dashgrid"><table><tbody>
            {byModel.map((m, i) => (
              <tr key={i}><td className="name">{m.provider}/{m.model}</td><td>{m._count}</td><td>${(m._sum.cost || 0).toFixed(4)}</td></tr>
            ))}
          </tbody></table></div>
        </div>
      </div>

      <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "20px 0 8px" }}>Top users</h2>
      <div className="dashgrid"><table><tbody>
        {byUser.map((u) => (
          <tr key={u.userId || "none"}><td className="name">{u.userId ? nameOf.get(u.userId) || "—" : "(system)"}</td><td>{u._count} calls</td><td>${(u._sum.cost || 0).toFixed(4)}</td></tr>
        ))}
        {byUser.length === 0 && <tr><td style={{ color: "var(--muted)" }}>No usage yet.</td></tr>}
      </tbody></table></div>

      <p className="dashnote">Free-tier models report $0 — the token counts show real consumption against your daily quotas. Add more keys in Settings to rotate when one runs out.</p>
    </div>
  );
}
