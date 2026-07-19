import { existsSync, readFileSync } from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { Block, Exercise, QuizQuestion } from "../lib/curriculum/blocks";

const prisma = new PrismaClient();

// Same scrypt format as lib/auth.ts (duplicated here because the seed runs
// under tsx without the Next.js "server-only" context).
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

// If `npm run import:lessons` has produced this, we seed all 15 real lessons.
const SEED_JSON = "prisma/curriculum.seed.json";

type SeedLesson = {
  code: string;
  title: string;
  goal: string;
  blocks: Block[];
  exercise: Exercise;
  quizBank: QuizQuestion[];
};

// A first slice of Unit 2, in the canonical block model. Import the remaining
// lessons any time via Admin → Editor → Import JSON (that's the "your data,
// your control" path from the brief). These four make the demo fully clickable.
const UNIT2: SeedLesson[] = [
  {
    code: "2.1",
    title: "Printing in Java",
    goal: "Display text and numbers on the screen with <b>System.out.println</b>, and control formatting with escape sequences.",
    blocks: [
      { type: "prose", html: "Every program needs to communicate with the person using it. In Java, the most basic way to send information to the screen is to <strong>print</strong> it." },
      { type: "heading", text: "Your first printed line" },
      { type: "prose", html: "Java code lives inside a <strong>class</strong> and runs starting from a special method called <code>main</code>. Treat the outer lines as a fixed frame you write your code inside." },
      { type: "code", code: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, world!");\n    }\n}', out: "Hello, world!" },
      { type: "prose", html: "<strong>1.</strong> Text goes in double quotes (a <strong>String</strong>). <strong>2.</strong> Every statement ends with a semicolon <code>;</code>. <strong>3.</strong> <code>println</code> adds a new line at the end." },
      { type: "callout", kind: "mistake", title: "Common beginner mistakes", html: "<strong>Forgetting the semicolon</strong> is the #1 cause of \"it won't compile.\" <strong>Forgetting the quotes</strong> makes Java look for a variable. <strong>Smart/curly quotes</strong> from a document are rejected — use straight quotes." },
      { type: "check", items: [["What is the difference between <code>print</code> and <code>println</code>?", "<code>println</code> moves to a new line after printing; <code>print</code> stays on the same line."]] },
      { type: "exercise", html: 'Print a three-line "business card": your name, a title, and an email — each on its own line.', meta: "checks: 3 lines of output" },
    ],
    exercise: {
      prompt: "Print exactly three lines: your name, a title, and an email — one per line.",
      starter: '// print three lines here\n',
      expected: "Ada Lovelace\nProgrammer\nada@classos.dev",
      behaviour: "Three separate lines of output, one for name, title, and email.",
    },
    quizBank: [
      { q: "Which command moves to a new line after printing?", opts: ["print", "println", "printf", "echo"], correct: 1, why: "println = print line." },
      { q: 'What does "a\\nb" print?', opts: ["a\\nb", "ab", "a then b on two lines", "error"], correct: 2, why: "\\n is a newline." },
      { q: 'What prints from "Sum: " + 3 + 4?', opts: ["Sum: 7", "Sum: 34", "error", "Sum: 3 4"], correct: 1, why: "Left-to-right: text + number becomes text." },
    ],
  },
  {
    code: "2.2",
    title: "Variables and Types",
    goal: "Store, name, and reuse values using <b>variables</b>, and choose the right <b>type</b> for each kind of data.",
    blocks: [
      { type: "prose", html: "A <strong>variable</strong> is a named box in memory that holds a value you want to keep and reuse." },
      { type: "heading", text: "Declaring a variable" },
      { type: "code", code: 'int age = 17;\ndouble price = 4.99;\nboolean isOpen = true;\nString name = "Ava";\n\nSystem.out.println(name + " is " + age);', out: "Ava is 17" },
      { type: "terms", items: [["int", "whole numbers"], ["double", "decimal numbers"], ["boolean", "true / false"], ["String", "text"]] },
      { type: "callout", kind: "tip", title: "= is assignment, not equality", html: 'Read <code>int age = 17;</code> as "make an integer box called age and put 17 in it."' },
      { type: "exercise", html: "Declare a variable for your age and one for your name, then print a sentence using both.", meta: "checks: one line combining both" },
    ],
    exercise: {
      prompt: "Declare an int and a String, then print one sentence using both.",
      starter: "int age = 16;\nString name = \"Sam\";\n// print a sentence using both\n",
      expected: "Sam is 16 years old",
      behaviour: "One line that combines the name and age into a sentence.",
    },
    quizBank: [
      { q: "Which type holds 4.99?", opts: ["int", "double", "boolean", "String"], correct: 1, why: "Decimals need double." },
      { q: "double d = 3; — allowed?", opts: ["No", "Yes, 3 becomes 3.0", "Only with quotes", "Only in loops"], correct: 1, why: "int widens to double." },
    ],
  },
  {
    code: "2.10",
    title: "While Loops",
    goal: "Repeat code an <b>unknown</b> number of times — as long as a condition stays true.",
    blocks: [
      { type: "prose", html: "A <strong>while loop</strong> repeats a block of code <em>as long as</em> a condition is true. Before every pass, Java checks the condition: true → run again; false → skip past." },
      { type: "heading", text: "Anatomy of a while loop" },
      { type: "code", code: "int n = 1;\nwhile (n <= 3) {\n    System.out.println(n);\n    n++;\n}", out: "1\n2\n3" },
      { type: "prose", html: "Three parts to get right: where the variable <strong>starts</strong>, the <strong>condition</strong> that keeps it going, and the line that <strong>moves it toward stopping</strong> (<code>n++</code>)." },
      { type: "callout", kind: "mistake", title: "The infinite loop", html: "If nothing inside the loop moves the condition toward false, it runs forever. The classic cause is forgetting the update line." },
      { type: "check", items: [["Why does a loop with no update line run forever?", "The condition never becomes false, so Java keeps re-running the block."]] },
      { type: "exercise", html: "Use a while loop to print the numbers 1, 2, 3 — each on its own line.", meta: "checks: output is 1, 2, 3" },
    ],
    exercise: {
      prompt: "Using a while loop, print 1, 2, 3 — each on its own line.",
      starter: "int n = 1;\n// your loop here\n",
      expected: "1\n2\n3",
      behaviour: "Prints 1, 2, 3 on separate lines using a while loop.",
    },
    quizBank: [
      { q: "int k=5; while(k>5){k--;} — how many iterations?", opts: ["5", "1", "0", "Infinite"], correct: 2, why: "5>5 is false at the first check." },
      { q: "Which line prevents an infinite loop in `int i=0; while(i<4){...}`?", opts: ["println(i);", "i++;", "int i=0;", "while(true);"], correct: 1, why: "Only updating i moves toward false." },
      { q: "Repeat until the user types stop. Condition?", opts: ['while(input=="stop")', 'while(!input.equals("stop"))', "while(true)", "while(input!=null)"], correct: 1, why: ".equals compares String content." },
      { q: "When does a while loop's body run zero times?", opts: ["Never", "When the condition is false at the first check", "Only with break", "When n is negative"], correct: 1, why: "The condition is checked before the first pass." },
    ],
  },
  {
    code: "2.11",
    title: "If Statements",
    goal: "Make decisions with <b>if</b>, <b>else if</b>, and <b>else</b>, running different code for different situations.",
    blocks: [
      { type: "prose", html: "An <strong>if statement</strong> lets a program choose what to do based on a condition." },
      { type: "code", code: "int score = 72;\nif (score >= 90) {\n    System.out.println(\"A\");\n} else if (score >= 60) {\n    System.out.println(\"Pass\");\n} else {\n    System.out.println(\"Try again\");\n}", out: "Pass" },
      { type: "callout", kind: "mistake", title: "Common beginner mistakes", html: "<strong>Using <code>=</code> instead of <code>==</code></strong> in a condition. <strong>A semicolon after the condition</strong>: <code>if (x &gt; 0);</code> ends the if immediately. <strong>Forgetting braces</strong> on multi-line blocks." },
      { type: "exercise", html: "Read a number with <code>inputInt</code> and print \"positive\", \"negative\", or \"zero\".", meta: "checks: correct branch for each case" },
    ],
    exercise: {
      prompt: 'Read an int with inputInt("Number: ") and print "positive", "negative", or "zero".',
      starter: 'int x = inputInt("Number: ");\n// decide and print\n',
      expected: "positive",
      behaviour: "Prints positive/negative/zero depending on the input value.",
      stdin: "5",
    },
    quizBank: [
      { q: "What's wrong with `if (x = 5)`?", opts: ["Nothing", "= is assignment, needs ==", "Missing braces", "Needs a semicolon"], correct: 1, why: "= assigns; == compares." },
      { q: "What does `if (x > 0);` followed by a block do?", opts: ["Runs block only if x>0", "Always runs the block (empty if)", "Compile error", "Never runs"], correct: 1, why: "The semicolon ends the if immediately." },
    ],
  },
];

const DEMO_STUDENTS = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson", "Linus Torvalds"];

async function main() {
  console.log("Seeding classOS…");

  // clean slate (safe for a dev prototype DB)
  await prisma.attempt.deleteMany();
  await prisma.progress.deleteMany();
  await prisma.aiCall.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.user.deleteMany();
  await prisma.class.deleteMany();

  // Exercises + quiz banks I authored for these 4 lessons — merged onto the
  // imported bodies so the graded exercise and clean quiz keep working.
  const EXTRAS: Record<string, { exercise: Exercise; quizBank: QuizQuestion[] }> = Object.fromEntries(
    UNIT2.map((l) => [l.code, { exercise: l.exercise, quizBank: l.quizBank }])
  );

  const chapters: any[] = existsSync(SEED_JSON)
    ? JSON.parse(readFileSync(SEED_JSON, "utf8")).chapters
    : [{ order: 2, title: "Unit 2 — Basic Java", lessons: UNIT2 }];

  let lessonCount = 0;
  for (const c of chapters) {
    const chapter = await prisma.chapter.create({ data: { order: c.order ?? 2, title: c.title } });
    const ls = c.lessons ?? [];
    for (let i = 0; i < ls.length; i++) {
      const l = ls[i];
      const extra = EXTRAS[l.code] || {};
      const exercise = l.exercise && Object.keys(l.exercise).length ? l.exercise : extra.exercise ?? {};
      const quizBank = l.quizBank && l.quizBank.length ? l.quizBank : extra.quizBank ?? [];
      await prisma.lesson.create({
        data: {
          chapterId: chapter.id,
          code: l.code,
          order: l.order ?? i,
          title: l.title,
          goal: l.goal ?? "",
          blocks: l.blocks as any,
          exercise: exercise as any,
          quizBank: quizBank as any,
        },
      });
      lessonCount++;
    }
  }

  // No public defaults: unless overridden, passwords are random per-seed and
  // printed below. (A fixed default in a public README = free admin access.)
  const genPw = () => crypto.randomBytes(9).toString("base64url");
  const adminPw = process.env.ADMIN_PASSWORD || genPw();
  const teacherPw = process.env.TEACHER_PASSWORD || genPw();

  await prisma.user.create({
    data: { name: "Owner", email: "admin@classos.dev", role: "ADMIN", passwordHash: hashPassword(adminPw) },
  });
  const teacher = await prisma.user.create({
    data: { name: "Ms. Rivera", email: "teacher@classos.dev", role: "TEACHER", passwordHash: hashPassword(teacherPw) },
  });

  const demoClass = await prisma.class.create({
    data: { name: "Period 3 — Intro Java", joinCode: "JAVA26", teacherId: teacher.id },
  });
  for (const name of DEMO_STUDENTS) {
    await prisma.user.create({ data: { name, role: "STUDENT", classId: demoClass.id } });
  }

  console.log(`Seeded ${lessonCount} lessons, 1 class, ${DEMO_STUDENTS.length + 2} users.`);
  console.log("");
  console.log("── Sign-in details (SAVE THESE — passwords are random) ──");
  console.log(`  Admin:    admin@classos.dev / ${adminPw}`);
  console.log(`  Teacher:  teacher@classos.dev / ${teacherPw}`);
  console.log(`  Students: join code JAVA26 + any name (at /join)`);
  console.log("  You can change passwords any time at /account.");
  console.log("─────────────────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
