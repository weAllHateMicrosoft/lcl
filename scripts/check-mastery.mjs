// Sanity check: run the SAME estimator math (lib/mastery.ts) against the seeded
// demo data and print each student's read, so we can confirm it matches the
// story built into the seed before viewing it in the app.
//   node --env-file=.env scripts/check-mastery.mjs

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CFG = { targetEvidence: 3, minConfidence: 0.5, strongAt: 0.75, halfLifeDays: 21 };

function estimate(answers) {
  if (!answers.length) return { state: "unknown", estimate: 0, confidence: 0, n: 0 };
  const now = Date.now();
  const HL = CFG.halfLifeDays * 24 * 3600 * 1000;
  let wSum = 0, wCorrect = 0, recencyMass = 0;
  for (const a of answers) {
    const recency = Math.pow(0.5, (now - a.at.getTime()) / HL);
    const diffW = Math.max(1, a.difficulty || 1);
    wSum += recency * diffW;
    if (a.correct) wCorrect += recency * diffW;
    recencyMass += recency;
  }
  const est = wSum > 0 ? wCorrect / wSum : 0;
  const conf = Math.min(1, recencyMass / CFG.targetEvidence);
  const state = conf < CFG.minConfidence ? "unknown" : est >= CFG.strongAt ? "strong" : "weak";
  return { state, estimate: est, confidence: conf, n: answers.length };
}

async function main() {
  const cls = await prisma.class.findFirst({ where: { name: "Demo — Mastery Test" } });
  if (!cls) return console.log("no demo class — run seed-mastery.mjs first");

  const skills = await prisma.skill.findMany({ where: { lessonId: { not: null } }, include: { questionSkills: true } });
  const byQ = new Map();
  for (const s of skills)
    for (const qs of s.questionSkills) {
      const arr = byQ.get(qs.questionId) || [];
      arr.push({ skillId: s.id, statement: s.statement, difficulty: s.difficulty || 1 });
      byQ.set(qs.questionId, arr);
    }

  const students = await prisma.user.findMany({ where: { classId: cls.id }, orderBy: { name: "asc" } });
  for (const st of students) {
    const events = await prisma.event.findMany({ where: { userId: st.id, type: "quiz.answer" }, select: { at: true, payload: true } });
    const bySkill = new Map();
    for (const ev of events) {
      const tags = byQ.get(ev.payload?.questionId);
      if (!tags) continue;
      for (const t of tags) {
        const arr = bySkill.get(t.statement) || [];
        arr.push({ correct: !!ev.payload.correct, at: ev.at, difficulty: t.difficulty });
        bySkill.set(t.statement, arr);
      }
    }
    console.log(`\n${st.name}`);
    for (const s of skills) {
      const r = estimate(bySkill.get(s.statement) || []);
      const tag = r.state === "strong" ? "✅ strong" : r.state === "weak" ? "⚠️  weak  " : "· unknown";
      console.log(`   ${tag}  ${s.statement.padEnd(28)}  est ${(r.estimate * 100).toFixed(0).padStart(3)}%  conf ${(r.confidence * 100).toFixed(0).padStart(3)}%  (${r.n} ans)`);
    }
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
