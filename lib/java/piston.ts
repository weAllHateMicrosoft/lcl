import "server-only";

// Real Java execution via the free public Piston API. Self-host Piston (Docker)
// when class size needs it — only PISTON_URL changes.
const PISTON_URL = process.env.PISTON_URL || "https://emkc.org/api/v2/piston";
const JAVA_VERSION = process.env.PISTON_JAVA_VERSION || "15.0.2";

export interface RunResult {
  compiled: boolean;
  stdout: string;
  error: string; // compile or runtime error, mapped back to the student's view
}

// Beginner template: students write `String n = input("Your name? ");` and skip
// all the Scanner boilerplate. We splice their code in and remember how many
// lines we added so we can map compiler error line numbers back.
const HEADER = `import java.util.Scanner;
public class Main {
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
  const offset = HEADER.split("\n").length - 1; // lines before student code
  return { source: HEADER + code + FOOTER, offset };
}

// Remap "Main.java:42:" style line numbers back to the student's editor lines.
function remapErrors(stderr: string, offset: number): string {
  return stderr.replace(/Main\.java:(\d+)/g, (_m, n) => {
    const line = Math.max(1, parseInt(n, 10) - offset);
    return `line ${line}`;
  });
}

export async function runJava(
  code: string,
  stdin = "",
  opts: { wrapBeginner?: boolean } = {}
): Promise<RunResult> {
  const { source, offset } = opts.wrapBeginner ? wrap(code) : { source: code, offset: 0 };

  let res: Response;
  try {
    res = await fetch(`${PISTON_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "java",
        version: JAVA_VERSION,
        files: [{ name: "Main.java", content: source }],
        stdin,
        compile_timeout: 10000,
        run_timeout: 5000,
      }),
    });
  } catch {
    return { compiled: false, stdout: "", error: "Could not reach the Java runner. Check your connection." };
  }

  if (!res.ok) {
    return { compiled: false, stdout: "", error: `Runner error (${res.status}). Try again in a moment.` };
  }

  const data = await res.json();

  // Compile phase failed → not compiled.
  if (data.compile && data.compile.code !== 0) {
    return { compiled: false, stdout: "", error: remapErrors(data.compile.stderr || data.compile.output || "Compilation failed.", offset) };
  }

  const run = data.run || {};
  const stdout = run.stdout ?? "";
  const stderr = run.stderr ?? "";
  // Compiled but threw at runtime — surface the exception but mark compiled true.
  if (run.code !== 0 && stderr) {
    return { compiled: true, stdout, error: remapErrors(stderr, offset) };
  }
  return { compiled: true, stdout, error: "" };
}
