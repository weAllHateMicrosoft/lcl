import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import LessonRenderer from "@/components/LessonRenderer";
import LessonWorkspace from "@/components/LessonWorkspace";
import type { Block, Exercise, QuizQuestion } from "@/lib/curriculum/blocks";

export default async function LessonPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const lesson = await prisma.lesson.findUnique({ where: { code } });
  if (!lesson) notFound();

  const blocks = lesson.blocks as unknown as Block[];
  const exercise = lesson.exercise as unknown as Exercise;
  const quizBank = lesson.quizBank as unknown as QuizQuestion[];

  return (
    <div className="lesson">
      <h1>{lesson.title}</h1>
      <div className="goal" dangerouslySetInnerHTML={{ __html: lesson.goal }} />
      <LessonRenderer blocks={blocks} />
      <LessonWorkspace lessonCode={lesson.code} exercise={exercise} quizBank={quizBank} />
    </div>
  );
}
