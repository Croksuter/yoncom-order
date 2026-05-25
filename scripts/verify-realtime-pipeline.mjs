import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const artifactPath = join(root, "artifacts", "realtime-verification", `${runId}.json`);

const commands = [
  { id: "typecheck", command: "pnpm", args: ["typecheck"] },
  { id: "test", command: "pnpm", args: ["test"] },
  { id: "build", command: "pnpm", args: ["build"] },
  { id: "diff-check", command: "git", args: ["diff", "--check"] },
];

const report = {
  runId,
  startedAt: new Date().toISOString(),
  cwd: root,
  commands: [],
  browserPolicy: {
    requiredTool: "browser:browser",
    forbiddenFallback: "standalone Playwright MCP/CLI for UI workflow verification",
    note: "Browser workflow must be run separately through Codex in-app Browser because this script cannot drive that plugin surface.",
  },
};

for (const item of commands) {
  report.commands.push(await runCommand(item));
}

report.finishedAt = new Date().toISOString();
report.ok = report.commands.every((command) => command.exitCode === 0);

await mkdir(dirname(artifactPath), { recursive: true });
await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`realtime verification report: ${artifactPath}`);

if (!report.ok) {
  process.exitCode = 1;
}

function runCommand({ id, command, args }) {
  return new Promise((resolve) => {
    const startedAt = new Date();
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, YONCOM_TRACE: process.env.YONCOM_TRACE ?? "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("close", (exitCode) => {
      const finishedAt = new Date();
      resolve({
        id,
        command: [command, ...args].join(" "),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        exitCode,
        stdoutTail: tail(stdout),
        stderrTail: tail(stderr),
      });
    });
  });
}

function tail(value) {
  return value.split(/\r?\n/).filter(Boolean).slice(-40);
}
