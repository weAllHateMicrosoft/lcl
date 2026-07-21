import { authClass } from "@/lib/classauth";
import ClassSettingsPanel from "@/components/teacher/class/ClassSettingsPanel";

export default async function SettingsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, cls } = await authClass(id);
  return (
    <ClassSettingsPanel
      classId={id}
      name={cls.name}
      joinCode={cls.joinCode}
      googleConnected={Boolean(me.googleRefreshToken)}
      googleEmail={me.googleEmail}
      googleCourseId={cls.googleCourseId}
      googleCourseName={cls.googleCourseName}
    />
  );
}
