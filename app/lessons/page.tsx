import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

// Land on the first lesson.
export default async function LessonsIndex() {
  const first = await prisma.lesson.findFirst({ orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }] });
  if (!first) {
    return (
      <div>
        <h1>No lessons yet</h1>
        <p>Run <code>npm run db:seed</code> to load the starter curriculum.</p>
      </div>
    );
  }
  redirect(`/lessons/${first.code}`);
}
