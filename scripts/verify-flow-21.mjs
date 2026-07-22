// Content verification for the 2.1 flow: compiles and RUNS every snippet
// through the real runner (Compiler Explorer, same as /api/run) and checks the
// authored expectations hold. An interactive lesson that lies about output
// teaches the misconception it exists to fix — so this must pass before ship.
//   node scripts/verify-flow-21.mjs

const GODBOLT = "https://godbolt.org/api/compiler/java2102/compile";
const HEADER = `import java.util.Scanner;
class Main {
    static Scanner __sc = new Scanner(System.in);
    static String input(String p){ System.out.print(p); return __sc.nextLine(); }
    public static void main(String[] args) {
`;
const FOOTER = `
    }
}`;

async function run(code) {
  const res = await fetch(GODBOLT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "classOS-edu/1.0" },
    body: JSON.stringify({
      source: HEADER + code + FOOTER,
      lang: "java",
      allowStoreCodeDebug: false,
      options: { userArguments: "", executeParameters: { args: [], stdin: "" }, compilerOptions: { executorRequest: true }, filters: { execute: true } },
    }),
  });
  const data = await res.json();
  const lines = (arr) => (arr || []).map((l) => l.text).join("\n");
  if (data.buildResult && data.buildResult.code !== 0) return { compiled: false, stdout: "", err: lines(data.buildResult.stderr) };
  return { compiled: true, stdout: lines(data.stdout), err: lines(data.stderr) };
}

const norm = (s) => (s || "").replace(/\r\n/g, "\n").trimEnd();

// [name, code, expected stdout | {mustFail:true} ]
const CHECKS = [
  ["f21_1 run", 'System.out.println("Hello, world!");', "Hello, world!"],
  ["f21_3 predict", 'System.out.println("Hi");\nSystem.out.println("Bye");', "Hi\nBye"],
  ["f21_4 predict", 'System.out.print("Hi");\nSystem.out.print("Bye");', "HiBye"],
  ["f21_5 fix (solution)", 'System.out.println("Java");\nSystem.out.println("rocks");', "Java\nrocks"],
  ["f21_6 run", 'System.out.println("one\\ntwo\\nthree");', "one\ntwo\nthree"],
  ["f21_7 predict", 'System.out.println("name\\tscore");', "name\tscore"],
  ["f21_8 broken MUST FAIL", 'System.out.println("She said "hi" to me");', { mustFail: true }],
  ["f21_8 fix (solution)", 'System.out.println("She said \\"hi\\" to me");', 'She said "hi" to me'],
  ["f21_9 run", 'System.out.println("Ada" + "Lovelace");', "AdaLovelace"],
  ["f21_10 predict", 'System.out.println("1" + 2 + 3);', "123"],
  ["f21_11 predict", 'System.out.println(1 + 2 + "3");', "33"],
  ["f21_12 arrange (solution)", 'System.out.print("Loading");\nSystem.out.println("...");\nSystem.out.println("Done!");', "Loading...\nDone!"],
  ["f21_13 write (solution)", 'System.out.println("Coffee\\t$3");\nSystem.out.println("Donut\\t$2");', "Coffee\t$3\nDonut\t$2"],
];

let fail = 0;
for (const [name, code, expected] of CHECKS) {
  const r = await run(code);
  if (expected && expected.mustFail) {
    if (!r.compiled) console.log(`✓ ${name}: fails to compile (as designed)`);
    else { console.log(`✗ ${name}: SHOULD FAIL but compiled, printed: ${JSON.stringify(r.stdout)}`); fail++; }
    continue;
  }
  if (!r.compiled) { console.log(`✗ ${name}: DID NOT COMPILE: ${r.err.slice(0, 120)}`); fail++; continue; }
  if (norm(r.stdout) === norm(expected)) console.log(`✓ ${name}: ${JSON.stringify(norm(r.stdout))}`);
  else { console.log(`✗ ${name}: expected ${JSON.stringify(norm(expected))} got ${JSON.stringify(norm(r.stdout))}`); fail++; }
}
console.log(fail ? `\n${fail} FAILURE(S)` : "\nall checks passed");
process.exit(fail ? 1 : 0);
