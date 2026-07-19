import "server-only";

// Java execution.
//
// The public Piston API went WHITELIST-ONLY on 2026-02-15 (verified: every call
// returns 401), so the default runner is now Compiler Explorer (godbolt.org),
// which executes Java for free without a key. If you self-host Piston (Docker),
// set PISTON_URL and it takes priority — same interface either way.

const PISTON_URL = process.env.PISTON_URL || ""; // self-hosted only
const PISTON_JAVA = process.env.PISTON_JAVA_VERSION || "15.0.2";
const GODBOLT_URL = process.env.GODBOLT_URL || "https://godbolt.org";
const GODBOLT_JAVA = process.env.GODBOLT_JAVA || "java2102"; // jdk 21.0.2

export interface RunResult {
  compiled: boolean;
  stdout: string;
  error: string; // compile or runtime error, remapped to the student's line numbers
}

// Beginner template: students write `String n = input("Your name? ");` with no
// Scanner boilerplate. NOTE: `class Main` is deliberately NOT public — runners
// save the source under arbitrary filenames (example.java on godbolt), and
// javac only allows that for non-public classes.
const HEADER = `import java.util.Scanner;
class Main {
    static Scanner __sc = new Scanner(System.in);
    static String input(String p){ System.out.print(p); return __sc.nextLine(); }
    static int inputInt(String p){ System.out.print(p); return Integer.parseInt(__sc.nextLine().trim()); }
    static double inputDouble(String p){ System.out.print(p); return Double.parseDouble(__sc.nextLine().trim()); }
    public static void main(String[] args) {
`;
const FOOTER = `
    }
}`;

function wrap(code: string): { source: string; offset: number } {
  const offset = HEADER.split("\n").length - 1;
  return { source: HEADER + code + FOOTER, offset };
}

// Remap compiler/stack-trace line numbers back to the student's editor lines.
// Godbolt reports "<source>:N:" and "example.java:N"; Piston "Main.java:N".
function remapErrors(text: string, offset: number): string {
  return text.replace(/(?:<source>|example\.java|Main\.java):(\d+)/g, (_m, n) => {
    return `line ${Math.max(1, parseInt(n, 10) - offset)}`;
  });
}

export async function runJava(
  code: string,
  stdin = "",
  opts: { wrapBeginner?: boolean } = {}
): Promise<RunResult> {
  const { source, offset } = opts.wrapBeginner ? wrap(code) : { source: code, offset: 0 };
  return PISTON_URL ? runViaPiston(source, stdin, offset) : runViaGodbolt(source, stdin, offset);
}

// ─── Compiler Explorer (default, free, no key) ───────────────────────────────

async function runViaGodbolt(source: string, stdin: string, offset: number): Promise<RunResult> {
  let res: Response;
  try {
    res = await fetch(`${GODBOLT_URL}/api/compiler/${GODBOLT_JAVA}/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "classOS-edu/1.0" },
      body: JSON.stringify({
        source,
        lang: "java",
        allowStoreCodeDebug: false,
        options: {
          userArguments: "",
          executeParameters: { args: [], stdin },
          compilerOptions: { executorRequest: true },
          filters: { execute: true },
        },
      }),
    });
  } catch {
    return { compiled: false, stdout: "", error: "Could not reach the Java runner. Check your connection and try again." };
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    return { compiled: false, stdout: "", error: `Runner error (${res.status}): ${body}` };
  }

  const data = await res.json();
  const lines = (arr: { text: string }[] | undefined) => (arr || []).map((l) => l.text).join("\n");

  const build = data.buildResult;
  if (build && build.code !== 0) {
    return { compiled: false, stdout: "", error: remapErrors(lines(build.stderr) || "Compilation failed.", offset) };
  }
  const stdout = lines(data.stdout);
  const stderr = lines(data.stderr);
  if (data.code !== 0 && stderr) {
    return { compiled: true, stdout, error: remapErrors(stderr, offset) };
  }
  return { compiled: true, stdout, error: "" };
}

// ─── Self-hosted Piston (set PISTON_URL to enable) ───────────────────────────

async function runViaPiston(source: string, stdin: string, offset: number): Promise<RunResult> {
  let res: Response;
  try {
    res = await fetch(`${PISTON_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "java",
        version: PISTON_JAVA,
        files: [{ name: "Main.java", content: source }],
        stdin,
        compile_timeout: 10000,
        run_timeout: 5000,
      }),
    });
  } catch {
    return { compiled: false, stdout: "", error: "Could not reach your Piston server." };
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    return { compiled: false, stdout: "", error: `Runner error (${res.status}): ${body}` };
  }
  const data = await res.json();
  if (data.compile && data.compile.code !== 0) {
    return { compiled: false, stdout: "", error: remapErrors(data.compile.stderr || "Compilation failed.", offset) };
  }
  const run = data.run || {};
  if (run.code !== 0 && run.stderr) {
    return { compiled: true, stdout: run.stdout ?? "", error: remapErrors(run.stderr, offset) };
  }
  return { compiled: true, stdout: run.stdout ?? "", error: "" };
}
