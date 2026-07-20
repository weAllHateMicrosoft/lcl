import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import LessonRenderer from "@/components/LessonRenderer";
import LessonWorkspace from "@/components/LessonWorkspace";
import StudentTools from "@/components/student/StudentTools";
import HighlightOnLoad from "@/components/lesson/HighlightOnLoad";
import type { Block, Exercise, QuizQuestion } from "@/lib/curriculum/blocks";
import { stripAnswers } from "@/lib/curriculum/questions";

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ highlight?: string }>;
}) {
  const { code } = await params;
  const { highlight } = await searchParams;
  const me = await currentUser();
  if (!me) redirect("/join");
  const lesson = await prisma.lesson.findUnique({ where: { code }, include: { chapter: true } });
  if (!lesson) notFound();

  const progress = await prisma.progress.findUnique({
    where: { userId_lessonId: { userId: me.id, lessonId: lesson.id } },
  });
  const status = progress?.status ?? "NOT_STARTED";
  const readiness = Math.round((progress?.readiness ?? 0) * 100);
  const pill = status === "MASTERED" ? "m" : status === "IN_PROGRESS" ? "p" : "n";
  const pillText = status === "MASTERED" ? "● MASTERED" : status === "IN_PROGRESS" ? "● IN PROGRESS" : "○ NOT STARTED";

  // Strip answer keys out of any inline quiz blocks before they reach the browser.
  const blocks = (lesson.blocks as unknown as Block[]).map((b) =>
    b.type === "quiz" ? { ...b, questions: b.questions.map(stripAnswers) } : b
  ) as Block[];
  const exercise = lesson.exercise as unknown as Exercise;
  const objectives = (lesson.objectives as unknown as string[]) || [];

  // "Ask teacher" on highlight is opt-in per teacher (their prefs).
  let askTeacher: { id: string; name: string } | null = null;
  if (me.classId) {
    const cls = await prisma.class.findUnique({ where: { id: me.classId }, include: { teacher: true } });
    if (cls?.teacher) {
      const prefs = await getSetting<{ askTeacher?: boolean }>(`prefs:${cls.teacher.id}`, {});
      if (prefs.askTeacher) askTeacher = { id: cls.teacher.id, name: cls.teacher.name };
    }
  }
  // Only the small formative subset (with answers) ships to the browser; the
  // full bank — the clean quiz's answer key — stays server-side (/api/quiz).
  const bank = (lesson.quizBank as unknown as QuizQuestion[]) || [];
  const practiceQuestions = bank.slice(0, 3);
  const hasBank = bank.length > 0;

  return (
    <>
      <div className="crumb">
        {lesson.chapter.title.toUpperCase()} · LESSON {lesson.code}
      </div>
      <h1 className="title">{lesson.title}</h1>
      <div>
        <span className={`status-pill ${pill}`}>{pillText}</span>
      </div>
      <div className="ready">
        <div className="barwrap">
          <div className="bar" style={{ width: `${readiness}%` }} />
        </div>
        <div className="lbl">
          readiness {readiness}% — the average of your last 5 attempts; only the 🔒 clean quiz sets MASTERED
        </div>
      </div>

      <div className="panel lesson">
        <h2>
          Lesson <span className="tag k">SET CONTENT — NOT AI</span>
        </h2>
        {lesson.goal && <div className="goalbox" dangerouslySetInnerHTML={{ __html: lesson.goal }} />}
        {objectives.length > 0 && (
          <div className="objectives">
            <div className="ch">🎯 IN THIS LESSON</div>
            <ul>
              {objectives.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
        )}
        <LessonRenderer blocks={blocks} lessonCode={lesson.code} />
      </div>
      {highlight && <HighlightOnLoad text={highlight} />}

      <LessonWorkspace
        lessonCode={lesson.code}
        lessonTitle={lesson.title}
        exercise={exercise}
        practiceQuestions={practiceQuestions}
        hasBank={hasBank}
        mastered={status === "MASTERED"}
      />
      <StudentTools lessonCode={lesson.code} askTeacher={askTeacher} />
    </>
  );
}
