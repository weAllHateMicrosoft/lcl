import "./globals.css";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "classOS",
  description: "Self-hosted, editable, AI-integrated Java teaching platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  const users = await prisma.user.findMany({ orderBy: { role: "asc" } });

  return (
    <html lang="en">
      <body>
        <Nav
          me={{ id: me.id, name: me.name, role: me.role }}
          users={users.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
        />
        {children}
      </body>
    </html>
  );
}
