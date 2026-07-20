import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import ExamRunner from "@/components/student/ExamRunner";

// Full-screen summative exam — its own tab, nothing else on screen, easier to
// focus. Questions come from /api/quiz (no answers); grading is server-side.
// SEB (Safe Exam Browser) integration hooks in here later.
export default async function ExamPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const me = await currentUser();
  if (!me) redirect("/join");
  const lesson = await prisma.lesson.findUnique({ where: { code } });
  if (!lesson) notFound();

  return (
    <div className="examwrap">
      <div className="sebbar" style={{ borderRadius: 0 }}>
        <span>🔒 CLEAN QUIZ — {lesson.code} {lesson.title.toUpperCase()}</span>
        <span>AI: DISABLED · GRADED ON THE SERVER</span>
      </div>
      <div className="exambody">
        <h1 className="title" style={{ fontSize: 28 }}>Clean Quiz — {lesson.title}</h1>
        <p style={{ color: "var(--muted)", marginBottom: 20 }}>
          Summative. Pass ≥ 75% → <b>MASTERED</b>. Practice never sets Mastered — this does. You can close this tab and retake
          any time.
        </p>
        <ExamRunner lessonCode={lesson.code} lessonTitle={lesson.title} />
      </div>
    </div>
  );
}
