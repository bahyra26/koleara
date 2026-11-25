import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const envLocalPath = resolve(rootDir, ".env.local");

let useAnonymousMode = true;
if (existsSync(envLocalPath)) {
  const content = readFileSync(envLocalPath, "utf8");
  const match = content.match(/^CONVEX_DEPLOYMENT=(.+)$/m);
  const deploymentVal = match ? match[1].trim() : "";
  if (
    deploymentVal &&
    !deploymentVal.startsWith("anonymous:") &&
    !deploymentVal.startsWith("local:")
  ) {
    useAnonymousMode = false;
  }
}

const isWin = process.platform === "win32";
const pnpmCmd = isWin ? "pnpm.cmd" : "pnpm";

const sharedEnv = {
  ...process.env,
  ...(useAnonymousMode ? { CONVEX_AGENT_MODE: "anonymous" } : {}),
};

const children = [];
let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill("SIGTERM");
      } catch {
        // Ignore cleanup errors
      }
    }
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Starting KOLEARA (Convex Backend + Next.js Frontend)...");

const convexProc = spawn(pnpmCmd, ["exec", "convex", "dev"], {
  cwd: rootDir,
  env: sharedEnv,
  stdio: "inherit",
  shell: isWin,
});
children.push(convexProc);

const nextProc = spawn(pnpmCmd, ["exec", "next", "dev"], {
  cwd: rootDir,
  env: sharedEnv,
  stdio: "inherit",
  shell: isWin,
});
children.push(nextProc);

nextProc.on("exit", (code) => {
  shutdown(code ?? 0);
});

convexProc.on("exit", (code) => {
  if (!shuttingDown && code && code !== 0) {
    console.warn(
      `[convex] exited with code ${code}; Next.js continues running.`
    );
  }
});
