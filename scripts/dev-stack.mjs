import { spawn } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const commands = [
  ["web", ["dev:web"]],
  ["api", ["dev:api"]],
];
const children = new Map();
let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  for (const child of children.values()) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
}

for (const [name, args] of commands) {
  const child = spawn(pnpm, args, {
    env: process.env,
    stdio: "inherit",
  });
  children.set(name, child);

  child.on("error", (error) => {
    console.error(`[dev] ${name} failed to start`, error);
    process.exitCode = 1;
    shutdown("SIGTERM");
  });

  child.on("exit", (code, signal) => {
    children.delete(name);

    if (!isShuttingDown && (code !== 0 || signal !== null)) {
      console.error(`[dev] ${name} exited unexpectedly (${signal ?? code})`);
      process.exitCode = code ?? 1;
      shutdown("SIGTERM");
    }

    if (children.size === 0) {
      process.exit(process.exitCode ?? 0);
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
