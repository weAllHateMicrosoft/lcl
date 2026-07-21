import { authClass } from "@/lib/classauth";
import { prisma } from "@/lib/db";
import RosterPanel from "@/components/teacher/class/RosterPanel";

export default async function StudentsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, cls } = await authClass(id);
  const students = await prisma.user.findMany({
    where: { classId: id, role: "STUDENT" },
    select: { id: true, name: true, email: true, passwordHash: true },
    orderBy: { name: "asc" },
  });

  return (
    <RosterPanel
      classId={id}
      joinCode={cls.joinCode}
      googleLinked={Boolean(cls.googleCourseId)}
      googleConnected={Boolean(me.googleRefreshToken)}
      students={students.map((s) => ({ id: s.id, name: s.name, email: s.email, active: Boolean(s.passwordHash) }))}
    />
  );
}
