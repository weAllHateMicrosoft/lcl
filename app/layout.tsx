import "./globals.css";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { unreadCount } from "@/lib/messaging";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "classOS",
  description: "Self-hosted, editable, AI-integrated Java teaching platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  const isStaff = me && me.role !== "STUDENT";

  // Cost badge is staff-only.
  const cost = isStaff ? await prisma.aiCall.aggregate({ _sum: { cost: true }, _count: true }) : null;
  const cls = me?.classId ? await prisma.class.findUnique({ where: { id: me.classId } }) : null;
  const unread = me ? await unreadCount(me.id) : 0;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,900&family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* apply saved theme before paint to avoid a flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('classos_theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Nav
          me={me ? { id: me.id, name: me.name, role: me.role, className: cls?.name, avatar: me.avatar } : null}
          cost={cost ? { total: cost._sum.cost || 0, calls: cost._count } : null}
          unread={unread}
        />
        {children}
      </body>
    </html>
  );
}
