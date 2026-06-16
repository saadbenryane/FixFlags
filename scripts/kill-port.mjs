#!/usr/bin/env node
import { execSync } from "node:child_process";

const port = Number(process.env.PORT) || 3000;

function listListeningPids(targetPort) {
  if (process.platform === "win32") {
    const output = execSync(`netstat -ano | findstr :${targetPort}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return [
      ...new Set(
        output
          .split("\n")
          .map((line) => line.trim().split(/\s+/).at(-1))
          .filter((pid) => pid && /^\d+$/.test(pid)),
      ),
    ];
  }

  return execSync(`lsof -ti tcp:${targetPort} -sTCP:LISTEN`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .trim()
    .split("\n")
    .filter(Boolean);
}

function killPort(targetPort) {
  let pids;
  try {
    pids = listListeningPids(targetPort);
  } catch {
    return;
  }

  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {
        // Process already exited.
      }
    }
  }
}

killPort(port);
