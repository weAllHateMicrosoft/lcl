// Authors the interactive flow for lesson 2.1 "Printing in Java" and tags its
// evidence-bearing steps to the lesson's skills. Designed for absolute
// beginners (first step = literally press one button) AND the already-fluent
// (every step is one tap/run if you know it; "⚡ prove it" fast-path in the
// player skips to the clean quiz). Near-zero text: the confusion → reveal beat
// does the teaching; captions are one line, after the fact.
//
//   node --env-file=.env scripts/author-flow-21.mjs

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// NOTE on escapes: '\\n' here = backslash-n IN THE JAVA SOURCE the student
// sees; '\n' here = a real newline in a TARGET/option string.
const STEPS = [
  // ── first contact ──
  {
    id: "f21_1", kind: "run",
    instruction: "This is a Java program. Run it.",
    code: 'System.out.println("Hello, world!");',
    after: "You just ran your first program. The computer did exactly what the line said.",
  },
  {
    id: "f21_2", kind: "tweak",
    instruction: "Change the message to anything you want. Run it.",
    code: 'System.out.println("Hello, world!");',
    target: "Hello, world!", // the original — success = output differs
    hint: "Change only the words between the quotes.",
    after: "Your words, on the screen. That's programming.",
  },

  // ── println vs print ──
  {
    id: "f21_3", kind: "predict",
    instruction: "What comes out?",
    code: 'System.out.println("Hi");\nSystem.out.println("Bye");',
    opts: ["Hi\nBye", "HiBye", "Hi Bye", "(an error)"],
    correct: 0,
    why: "println = print line: it ends the line after printing. Two printlns → two lines.",
  },
  {
    id: "f21_4", kind: "predict",
    instruction: "Same code — but print, no ln. Now what?",
    code: 'System.out.print("Hi");\nSystem.out.print("Bye");',
    opts: ["HiBye", "Hi\nBye", "Hi Bye", "(an error)"],
    correct: 0,
    why: "print doesn't end the line — the next print continues right where it left off.",
  },
  {
    id: "f21_5", kind: "fix",
    instruction: "Make it match the target.",
    code: 'System.out.print("Java");\nSystem.out.print("rocks");',
    target: "Java\nrocks",
    hint: "Which one ends the line — print or println?",
    after: "println ends the line; print doesn't. That's the whole difference.",
  },

  // ── escape sequences ──
  {
    id: "f21_6", kind: "run",
    instruction: "One line of code. Run it and watch the \\n.",
    code: 'System.out.println("one\\ntwo\\nthree");',
    after: "\\n means new line — even in the middle of one message.",
  },
  {
    id: "f21_7", kind: "predict",
    instruction: "What does \\t do?",
    code: 'System.out.println("name\\tscore");',
    opts: ["name\tscore", "name\\tscore", "namescore", "name\nscore"],
    correct: 0,
    why: "\\t prints a tab — a wide gap. Great for lining things up.",
  },
  {
    id: "f21_8", kind: "fix",
    instruction: "It's broken. Run it, read the error, fix it.",
    code: 'System.out.println("She said "hi" to me");',
    target: 'She said "hi" to me',
    hint: 'Quotes inside quotes confuse Java. \\" means: print a real quote mark.',
    after: '\\" prints a quote without ending the text. Errors point at the problem — reading them is a skill.',
  },

  // ── + and text ──
  {
    id: "f21_9", kind: "run",
    instruction: "Run it. What does + do to text?",
    code: 'System.out.println("Ada" + "Lovelace");',
    after: "+ glues text together — and adds no space. You control the spaces.",
  },
  {
    id: "f21_10", kind: "predict",
    instruction: "The classic. What prints?",
    code: 'System.out.println("1" + 2 + 3);',
    opts: ["123", "6", "15", "(an error)"],
    correct: 0,
    why: 'Left to right: "1"+2 makes the TEXT "12", then "12"+3 makes "123". Once text joins in, + glues.',
  },
  {
    id: "f21_11", kind: "predict",
    instruction: "Flip it. Now what prints?",
    code: 'System.out.println(1 + 2 + "3");',
    opts: ["33", "123", "6", "(an error)"],
    correct: 0,
    why: 'Still left to right: 1+2=3 (real math — no text yet), then 3+"3" glues into "33".',
  },

  // ── boss level ──
  {
    id: "f21_12", kind: "arrange",
    instruction: "Tap the lines in order to match the target.",
    lines: [
      'System.out.print("Loading");',
      'System.out.println("...");',
      'System.out.println("Done!");',
    ],
    target: "Loading...\nDone!",
    hint: "print keeps going on the same line. println ends it.",
    after: "print + println together control exactly how output flows.",
  },
  {
    id: "f21_13", kind: "write",
    instruction: "Your turn. Print this receipt — match it exactly.",
    code: "// your code here\n",
    target: "Coffee\t$3\nDonut\t$2",
    hint: "One println per line, and \\t for the gap.",
    after: "You wrote a real program from scratch. Everything on this receipt, you now control.",
  },
];

// Evidence: which steps demonstrate which of 2.1's skills.
const TAGS = {
  "distinguish between system.out.print and system.out.println behavior": ["f21_3", "f21_4", "f21_5", "f21_12"],
  "interpret escape sequences in printed text": ["f21_7", "f21_8", "f21_13"],
  "predict the result of string concatenation mixed with numeric addition": ["f21_10", "f21_11"],
};

async function main() {
  const lesson = await prisma.lesson.findUnique({ where: { code: "2.1" } });
  if (!lesson) throw new Error("lesson 2.1 not found");

  await prisma.lesson.update({ where: { id: lesson.id }, data: { flow: { v: 1, steps: STEPS } } });
  console.log(`✓ 2.1 flow written (${STEPS.length} steps)`);

  const skills = await prisma.skill.findMany({ where: { lessonId: lesson.id } });
  for (const [stmt, stepIds] of Object.entries(TAGS)) {
    const skill = skills.find((s) => s.statement.toLowerCase() === stmt);
    if (!skill) {
      console.warn(`! skill not found: ${stmt}`);
      continue;
    }
    for (const questionId of stepIds) {
      await prisma.questionSkill.upsert({
        where: { questionId_skillId: { questionId, skillId: skill.id } },
        create: { questionId, skillId: skill.id, origin: "teacher" },
        update: {},
      });
    }
    console.log(`✓ tagged ${stepIds.length} steps → "${skill.statement}"`);
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
