// Disposable demo data for testing the mastery estimator (STUDENT-MODEL.md §3–4).
//
//   node --env-file=.env scripts/seed-mastery.mjs         # seed (wipes prior demo first)
//   node --env-file=.env scripts/seed-mastery.mjs clean   # remove all demo data
//
// Creates an isolated demo chapter/lesson/class so it's trivial to delete, and
// five students with KNOWN stories — so you can check the system's read against
// the truth built in:
//   Ada   — strong everywhere
//   Ben   — guessing (~50%)            → weak everywhere
//   Cara  — nails loops, fails recursion → the showcase: one specific gap
//   Dan   — barely answered anything   → "not enough evidence" everywhere
//   Eve   — bombed weeks ago, aces it now → recency: recent mastery wins

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CLASS_NAME = "Demo — Mastery Test";
const CHAPTER_TITLE = "__DEMO_MASTERY__";
const DAY = 24 * 3600 * 1000;

async function clean() {
  const cls = await prisma.class.findFirst({ where: { name: CLASS_NAME } });
  if (cls) {
    const students = await prisma.user.findMany({ where: { classId: cls.id }, select: { id: true } });
    const ids = students.map((s) => s.id);
    if (ids.length) await prisma.event.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { classId: cls.id } });
    await prisma.class.delete({ where: { id: cls.id } });
  }
  // deleting the demo chapter cascades lesson → skill → questionSkill
  await prisma.chapter.deleteMany({ where: { title: CHAPTER_TITLE } });
  console.log("· cleaned prior demo data");
}

async function seed() {
  await clean();

  // ── isolated curriculum ──
  const chapter = await prisma.chapter.create({ data: { order: 9999, title: CHAPTER_TITLE } });
  const lesson = await prisma.lesson.create({
    data: {
      chapterId: chapter.id,
      code: "DEMO.1",
      order: 1,
      title: "Demo lesson — loops, modulo, recursion",
      goal: "seed data for mastery testing",
      blocks: [],
      exercise: {},
      quizBank: [],
    },
  });

  // ── skills (with difficulty) + synthetic tagged questions ──
  const defs = [
    { key: "loop", statement: "trace a for-loop", difficulty: 2 },
    { key: "mod", statement: "apply the modulo operator", difficulty: 2 },
    { key: "nest", statement: "predict nested-loop output", difficulty: 3 },
    { key: "rec", statement: "trace a recursive call", difficulty: 4 },
  ];
  const NQ = 6; // questions per skill — enough evidence that the story is clear, not noisy
  const questions = {}; // key -> [questionId,...]
  for (const d of defs) {
    const skill = await prisma.skill.create({
      data: { lessonId: lesson.id, statement: d.statement, difficulty: d.difficulty, origin: "ai", confidence: 0.6 },
    });
    questions[d.key] = [];
    for (let i = 0; i < NQ; i++) {
      const questionId = `demo_${d.key}_${i}`;
      questions[d.key].push(questionId);
      await prisma.questionSkill.create({ data: { questionId, skillId: skill.id, origin: "ai" } });
    }
  }

  // ── class + students ──
  const cls = await prisma.class.create({
    data: { name: CLASS_NAME, joinCode: "DEMO" + Math.random().toString(36).slice(2, 6).toUpperCase() },
  });

  const answer = (userId, questionId, correct, daysAgo) =>
    prisma.event.create({
      data: {
        type: "quiz.answer",
        userId,
        classId: cls.id,
        at: new Date(Date.now() - daysAgo * DAY),
        payload: { v: 1, questionId, correct, lessonId: lesson.id, source: "practice", chosen: correct ? 0 : 1 },
      },
    });

  // p = target correct rate per skill. DETERMINISTIC (exactly round(p·n) correct)
  // so the demo always tells the intended story — no unlucky RNG runs.
  async function play(userId, perSkillProb, opts = {}) {
    for (const key of Object.keys(questions)) {
      const p = perSkillProb[key];
      if (p === undefined) continue; // skill left untouched → "not enough evidence"
      const qs = questions[key];
      const correctCount = Math.round(p * qs.length);
      for (let i = 0; i < qs.length; i++) {
        const isCorrect = i < correctCount;
        if (opts.improving) {
          await answer(userId, qs[i], false, 55 + (i % 5)); // bombed weeks ago
          await answer(userId, qs[i], true, 1 + (i % 3)); // aces recently
        } else {
          await answer(userId, qs[i], isCorrect, 1 + (i % 5));
        }
      }
    }
  }

  const mk = (name) => prisma.user.create({ data: { name, role: "STUDENT", classId: cls.id } });

  const ada = await mk("Ada (strong)");
  await play(ada.id, { loop: 0.92, mod: 0.92, nest: 0.9, rec: 0.88 });

  const ben = await mk("Ben (guessing)");
  await play(ben.id, { loop: 0.5, mod: 0.5, nest: 0.5, rec: 0.5 });

  const cara = await mk("Cara (recursion gap)");
  await play(cara.id, { loop: 0.92, mod: 0.9, nest: 0.88, rec: 0.15 });

  const dan = await mk("Dan (barely started)");
  await answer(dan.id, questions.loop[0], true, 1); // just two answers total
  await answer(dan.id, questions.mod[0], true, 1);

  const eve = await mk("Eve (improving)");
  await play(eve.id, { loop: 1, mod: 1, nest: 1, rec: 1 }, { improving: true });

  console.log(`✓ seeded "${CLASS_NAME}" (join ${cls.joinCode}) with 5 students + ${defs.length} skills`);
  console.log(`  open: /class/${cls.id}/mastery`);
}

const mode = process.argv[2];
(mode === "clean" ? clean() : seed())
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
