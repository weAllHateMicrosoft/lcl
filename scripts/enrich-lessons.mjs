// Enrich lessons 2.1–2.4 into complete lesson plans (owner-approved demo
// content): objectives, a typed mastery quiz, and curated skills with every
// question tagged to the skill it tests. This is PERMANENT curriculum content
// (not demo people) — it only fills what's empty and never overwrites existing
// teacher work. Safe to re-run.
//
//   node --env-file=.env scripts/enrich-lessons.mjs

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Per lesson: objectives ↔ skills (same statements — the honest 1:1 the coarse
// v1 wants), plus mastery-quiz questions each tagged to one skill by index.
const PLAN = {
  "2.1": {
    objectives: [
      "distinguish between System.out.print and System.out.println behavior",
      "interpret escape sequences in printed text",
      "predict the result of string concatenation mixed with numeric addition",
    ],
    difficulty: [1, 2, 3],
    questions: [
      { id: "q21_1", skill: 0, type: "mcq", q: "What is the difference between System.out.println and System.out.print?", opts: ["println adds a new line after printing; print does not", "print adds a new line; println does not", "They are identical", "println can only print Strings"], correct: 0, why: "println = print line: it moves the cursor to the next line afterwards." },
      { id: "q21_2", skill: 0, type: "mcq", q: 'What does this print?\nSystem.out.print("Hi");\nSystem.out.print("!");', opts: ["Hi!", "Hi !", "Hi\\n!", "Hi (then ! on the next line)"], correct: 0, why: "print doesn't add line breaks, so the outputs run together." },
      { id: "q21_3", skill: 1, type: "mcq", q: 'What does System.out.println("a\\nb"); print?', opts: ["a then b on the next line", "a\\nb exactly", "ab", "an error"], correct: 0, why: "\\n is the newline escape sequence." },
      { id: "q21_4", skill: 1, type: "short", q: "Which escape sequence prints a TAB character?", answers: ["\\t", "backslash t", "\\\\t"], caseSensitive: false },
      { id: "q21_5", skill: 2, type: "mcq", q: 'What does System.out.println("1" + 2 + 3); print?', opts: ["123", "6", "15", "socket error"], correct: 0, why: 'Left to right: "1"+2 → "12" (string), then "12"+3 → "123".' },
      { id: "q21_6", skill: 2, type: "mcq", q: "What does System.out.println(1 + 2 + \"3\"); print?", opts: ["33", "123", "6", "15"], correct: 0, why: "1+2 → 3 (numbers first), then 3+\"3\" → \"33\"." },
    ],
  },
  "2.2": {
    objectives: [
      "declare and initialize variables with the correct type",
      "choose between int, double, boolean and String for a given value",
      "trace how a variable's value changes through assignments",
    ],
    difficulty: [1, 2, 2],
    questions: [
      { id: "q22_1", skill: 0, type: "mcq", q: "Which line correctly declares an integer variable named count set to 5?", opts: ["int count = 5;", "count int = 5;", "integer count = 5", "count = int 5;"], correct: 0, why: "type name = value;" },
      { id: "q22_2", skill: 1, type: "mcq", q: "Which type should store the value 3.14?", opts: ["double", "int", "boolean", "String"], correct: 0, why: "Decimal numbers need double." },
      { id: "q22_3", skill: 1, type: "mcq", q: "Which type should store whether a user is signed in?", opts: ["boolean", "String", "int", "double"], correct: 0, why: "true/false → boolean." },
      { id: "q22_4", skill: 2, type: "mcq", q: "int x = 5;\nx = x + 2;\nx = x * 2;\nWhat is x now?", opts: ["14", "12", "10", "7"], correct: 0, why: "5→7→14; each assignment replaces the value." },
      { id: "q22_5", skill: 2, type: "tf", q: "Once a variable is assigned, its value can never change.", correct: false, why: "Variables vary — assignment replaces the stored value." },
    ],
  },
  "2.3": {
    objectives: [
      "read user input using the Scanner class",
      "choose the right Scanner method for each input type",
      "prompt the user before reading input",
    ],
    difficulty: [1, 2, 2],
    questions: [
      { id: "q23_1", skill: 0, type: "mcq", q: "What must you import to use Scanner?", opts: ["java.util.Scanner", "java.io.Scanner", "java.input.Scanner", "nothing — it's built in"], correct: 0, why: "Scanner lives in java.util." },
      { id: "q23_2", skill: 0, type: "mcq", q: "Which line creates a Scanner that reads from the keyboard?", opts: ["Scanner input = new Scanner(System.in);", "Scanner input = System.in.read();", "new Scanner = System.in;", "Scanner.open(System.in);"], correct: 0, why: "System.in is the keyboard stream." },
      { id: "q23_3", skill: 1, type: "mcq", q: "Which method reads a whole int from the user?", opts: ["nextInt()", "nextLine()", "readInt()", "getInt()"], correct: 0, why: "nextInt() parses the next token as an int." },
      { id: "q23_4", skill: 1, type: "mcq", q: "Which method reads an entire line of text (including spaces)?", opts: ["nextLine()", "next()", "nextString()", "readAll()"], correct: 0, why: "next() stops at whitespace; nextLine() takes the whole line." },
      { id: "q23_5", skill: 2, type: "mcq", q: "What's the right order for asking a user their age?", opts: ["Print a prompt, then call nextInt()", "Call nextInt(), then print a prompt", "Prompts are optional syntax", "Scanner prompts automatically"], correct: 0, why: "Users need to know what to type before the program waits for input." },
    ],
  },
  "2.4": {
    objectives: [
      "evaluate arithmetic expressions using order of operations",
      "predict the result of integer division",
      "use the modulo operator to find remainders",
    ],
    difficulty: [2, 3, 3],
    questions: [
      { id: "q24_1", skill: 0, type: "mcq", q: "What is 2 + 3 * 4?", opts: ["14", "20", "24", "9"], correct: 0, why: "Multiplication first: 3*4=12, then +2." },
      { id: "q24_2", skill: 0, type: "mcq", q: "What is (2 + 3) * 4?", opts: ["20", "14", "24", "11"], correct: 0, why: "Parentheses first." },
      { id: "q24_3", skill: 1, type: "mcq", q: "In Java, what is 7 / 2 when both are ints?", opts: ["3", "3.5", "4", "an error"], correct: 0, why: "Integer division drops the decimal part — it does NOT round." },
      { id: "q24_4", skill: 1, type: "mcq", q: "What is 10 / 4 in integer arithmetic?", opts: ["2", "2.5", "3", "0"], correct: 0, why: "10/4 = 2.5 → truncated to 2." },
      { id: "q24_5", skill: 2, type: "mcq", q: "What is 7 % 2?", opts: ["1", "3", "3.5", "0"], correct: 0, why: "% gives the remainder: 7 = 2*3 + 1." },
      { id: "q24_6", skill: 2, type: "mcq", q: "Which expression is true exactly when n is even?", opts: ["n % 2 == 0", "n / 2 == 0", "n % 2 == 1", "n * 2 == 0"], correct: 0, why: "Even numbers leave remainder 0 when divided by 2." },
    ],
  },
};

async function main() {
  for (const [code, plan] of Object.entries(PLAN)) {
    const lesson = await prisma.lesson.findUnique({ where: { code } });
    if (!lesson) {
      console.log(`· ${code}: not found, skipped`);
      continue;
    }

    // objectives: fill only if empty (never clobber teacher work)
    const hasObj = (lesson.objectives ?? []).length > 0;
    // masteryQuiz: fill only if empty
    const hasMq = (lesson.masteryQuiz ?? []).length > 0;

    const questions = plan.questions.map((q) => {
      const base = { id: q.id, type: q.type, points: 1, q: q.q };
      if (q.type === "mcq") return { ...base, opts: q.opts, correct: q.correct, why: q.why };
      if (q.type === "tf") return { ...base, correct: q.correct, why: q.why };
      if (q.type === "short") return { ...base, answers: q.answers, caseSensitive: q.caseSensitive === true };
      return base;
    });

    await prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        ...(hasObj ? {} : { objectives: plan.objectives }),
        ...(hasMq ? {} : { masteryQuiz: questions }),
      },
    });

    // skills: reuse an existing skill on this lesson with the same statement
    // (case-insensitive); otherwise create as teacher-curated.
    const existing = await prisma.skill.findMany({ where: { lessonId: lesson.id } });
    const skillIds = [];
    for (let i = 0; i < plan.objectives.length; i++) {
      const stmt = plan.objectives[i];
      let skill = existing.find((s) => s.statement.toLowerCase() === stmt.toLowerCase());
      if (!skill) {
        skill = await prisma.skill.create({
          data: { lessonId: lesson.id, statement: stmt, difficulty: plan.difficulty[i], origin: "teacher", confidence: 1 },
        });
      }
      skillIds.push(skill.id);
    }

    // tag every question to its skill
    for (const q of plan.questions) {
      await prisma.questionSkill.upsert({
        where: { questionId_skillId: { questionId: q.id, skillId: skillIds[q.skill] } },
        create: { questionId: q.id, skillId: skillIds[q.skill], origin: "teacher" },
        update: {},
      });
    }

    console.log(`✓ ${code}: obj ${hasObj ? "kept" : "set"}, quiz ${hasMq ? "kept" : `set (${questions.length} q)`}, ${plan.objectives.length} skills tagged`);
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
