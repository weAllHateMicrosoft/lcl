import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

// Returns a Safe Exam Browser config (.seb, an XML plist) that launches SEB
// straight into this exam. Distribute the file, or use a sebs:// link to it.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) return new Response("sign in first", { status: 401 });

  const test = await prisma.test.findUnique({ where: { id } });
  if (!test) return new Response("not found", { status: 404 });

  const origin = originOf(req);
  const examUrl = `${origin}/exam/test/${id}`;
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>startURL</key><string>${examUrl}</string>
  <key>sendBrowserExamKey</key><true/>
  <key>allowQuit</key><true/>
  <key>quitURL</key><string>${origin}/tests</string>
  <key>browserWindowAllowReload</key><true/>
  <key>allowPreferencesWindow</key><false/>
  <key>allowSpellCheck</key><false/>
  <key>URLFilterEnable</key><false/>
</dict>
</plist>`;

  return new Response(plist, {
    headers: {
      "Content-Type": "application/seb",
      "Content-Disposition": `attachment; filename="${(test.title || "exam").replace(/[^a-z0-9]+/gi, "-")}.seb"`,
    },
  });
}

function originOf(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
