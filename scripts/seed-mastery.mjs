// Disposable demo PEOPLE for the AI overseer + progress views. Runs on the REAL
// curriculum (lessons 2.1–2.4, enriched by enrich-lessons.mjs — run that first).
//
//   node --env-file=.env scripts/seed-mastery.mjs         # seed (re-runs clean first)
//   node --env-file=.env scripts/seed-mastery.mjs clean   # remove the demo class & students
//
// Five students with KNOWN stories, each leaving a full activity trail
// (lesson views, item answers, tutor questions, code runs) so the overseer has
// a real record to read:
//   Ada  — strong everywhere, works steadily
//   Ben  — guessing (~50%), asks the tutor for answers
//   Cara — strong on 2.1–2.3, collapses on 2.4 arithmetic; her tutor questions
//          say exactly why (integer division + modulo confusion)
//   Dan  — opened 2.1 once, answered 2 questions, vanished
//   Eve  — bombed 2.1–2.2 seven weeks ago, aces everything recently

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CLASS_NAME = "Demo — Mastery Test";
const DAY = 24 * 3600 * 1000;
const LESSONS = ["2.1", "2.2", "2.3", "2.4"];

async function clean() {
  const cls = await prisma.class.findFirst({ where: { name: CLASS_NAME } });
  if (cls) {
    const students = await prisma.user.findMany({ where: { classId: cls.id }, select: { id: true } });
    const ids = students.map((s) => s.id);
    if (ids.length) {
      await prisma.event.deleteMany({ where: { userId: { in: ids } } });
      await prisma.studentInsight.deleteMany({ where: { userId: { in: ids } } });
    }
    await prisma.user.deleteMany({ where: { classId: cls.id } });
    await prisma.class.delete({ where: { id: cls.id } });
  }
  // legacy synthetic chapter from the first demo round
  await prisma.chapter.deleteMany({ where: { title: "__DEMO_MASTERY__" } });
  console.log("· cleaned prior demo data");
}

async function seed() {
  await clean();

  // real lessons + their tagged questions, grouped lesson → skill → questionIds
  const lessons = await prisma.lesson.findMany({
    where: { code: { in: LESSONS } },
    include: { skills: { include: { questionSkills: true } } },
  });
  const byCode = new Map(lessons.map((l) => [l.code, l]));
  for (const code of LESSONS) {
    const l = byCode.get(code);
    if (!l || !l.skills.length || !l.skills.some((s) => s.questionSkills.length)) {
      console.error(`✗ lesson ${code} has no tagged questions — run enrich-lessons.mjs first`);
      process.exit(1);
    }
  }

  const cls = await prisma.class.create({
    data: { name: CLASS_NAME, joinCode: "DEMO" + Math.random().toString(36).slice(2, 6).toUpperCase() },
  });

  const ev = (userId, type, daysAgo, payload) =>
    prisma.event.create({
      data: { type, userId, classId: cls.id, at: new Date(Date.now() - daysAgo * DAY), payload: { v: 1, ...payload } },
    });

  const view = (u, l, d) => ev(u, "lesson.view", d, { lessonId: l.id, code: l.code });
  const run = (u, l, d, ok = true) => ev(u, "code.run", d, { lessonCode: l.code, compiled: ok });
  const ask = (u, l, d, q) => ev(u, "tutor.message", d, { lessonId: l.id, lessonCode: l.code, question: q, reply: "(tutor gave a guiding hint)" });

  // answer every tagged question of a lesson at accuracy p (deterministic:
  // exactly round(p·n) correct per skill), spread over recent days
  async function work(userId, code, p, { daysAgo = null, source = "practice" } = {}) {
    const l = byCode.get(code);
    for (const skill of l.skills) {
      const qids = skill.questionSkills.map((qs) => qs.questionId);
      const nCorrect = Math.round(p * qids.length);
      for (let i = 0; i < qids.length; i++) {
        const d = daysAgo ?? 1 + ((i * 3) % 6);
        await ev(userId, "quiz.answer", d, {
          questionId: qids[i],
          correct: i < nCorrect,
          lessonId: l.id,
          source,
          chosen: i < nCorrect ? 0 : 1,
        });
      }
    }
  }

  const mk = (name) => prisma.user.create({ data: { name, role: "STUDENT", classId: cls.id } });

  // ── Ada: strong and steady ──
  const ada = await mk("Ada Chen");
  for (const [i, code] of LESSONS.entries()) {
    const l = byCode.get(code);
    await view(ada.id, l, 8 - i * 2);
    await view(ada.id, l, 2);
    await work(ada.id, code, 0.95);
    await run(ada.id, l, 3);
  }
  await ask(ada.id, byCode.get("2.4"), 2, "Is there a shortcut for checking if a number is divisible by both 3 and 5?");

  // ── Ben: guessing, answer-hunting ──
  const ben = await mk("Ben Okafor");
  for (const code of LESSONS) {
    const l = byCode.get(code);
    await view(ben.id, l, 5);
    await work(ben.id, code, 0.5);
  }
  await ask(ben.id, byCode.get("2.2"), 4, "whats the answer to the quiz");
  await ask(ben.id, byCode.get("2.4"), 2, "can you just tell me what 7/2 is in java");
  await run(ben.id, byCode.get("2.2"), 3, false);

  // ── Cara: strong until 2.4, where arithmetic falls apart ──
  const cara = await mk("Cara Ilyes");
  for (const code of ["2.1", "2.2", "2.3"]) {
    const l = byCode.get(code);
    await view(cara.id, l, 9);
    await work(cara.id, code, 0.95);
    await run(cara.id, l, 6);
  }
  const l24 = byCode.get("2.4");
  await view(cara.id, l24, 3);
  await view(cara.id, l24, 1);
  await work(cara.id, "2.4", 0.2);
  await ask(cara.id, l24, 2, "why is 7/2 equal to 3 and not 3.5?? that makes no sense");
  await ask(cara.id, l24, 1, "I still don't get what % actually does, is it percent?");
  await run(cara.id, l24, 1, true);

  // ── Dan: barely started ──
  const dan = await mk("Dan Petrov");
  const l21 = byCode.get("2.1");
  await view(dan.id, l21, 12);
  const danQs = l21.skills[0].questionSkills.map((qs) => qs.questionId).slice(0, 2);
  for (const [i, qid] of danQs.entries()) {
    await ev(dan.id, "quiz.answer", 12, { questionId: qid, correct: i === 0, lessonId: l21.id, source: "practice", chosen: i === 0 ? 0 : 1 });
  }

  // ── Eve: rough start seven weeks ago, excellent now ──
  const eve = await mk("Eve Almeida");
  for (const code of ["2.1", "2.2"]) {
    await work(eve.id, code, 0.15, { daysAgo: 49 });
    await ask(eve.id, byCode.get(code), 49, "I am completely lost on this lesson");
  }
  for (const code of LESSONS) {
    const l = byCode.get(code);
    await view(eve.id, l, 4);
    await work(eve.id, code, 0.95);
  }
  await run(eve.id, byCode.get("2.3"), 2);
  await ask(eve.id, byCode.get("2.4"), 1, "I used % to build FizzBuzz and it worked! Is that the standard way?");

  console.log(`✓ seeded "${CLASS_NAME}" (join ${cls.joinCode}) — 5 students with full activity on lessons ${LESSONS.join(", ")}`);
  console.log(`  teacher view: /class/${cls.id}/mastery`);
}

const mode = process.argv[2];
(mode === "clean" ? clean() : seed())
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
