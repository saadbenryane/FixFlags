#!/usr/bin/env node
/**
 * FixFlags company readout — deterministic board/goal state used by:
 *  - humans: `npm run agent:heartbeat` (tier-aware, emoji-scannable)
 *  - the pi-web heartbeat runtime: `node scripts/agent-heartbeat.mjs --json`
 *
 * The --json payload feeds the deterministic evidence packet
 * (.agents/company/heartbeat-cadence.md). Never fabricates metrics; every
 * number comes from .agents/BOARD.md / .agents/GOAL.md.
 */

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const boardPath = path.join(repoRoot, ".agents", "BOARD.md");
const goalPath = path.join(repoRoot, ".agents", "GOAL.md");

const statusOrder = ["in-progress", "review", "blocked", "queued", "done", "abandoned"];
const statusEmojis = {
  "in-progress": "🟡",
  review: "👀",
  blocked: "🚫",
  queued: "⏳",
  done: "✅",
  abandoned: "🗑️",
};

/** @typedef {{id?: string, task: string, status: string, owner: string, scope: string, updated?: string}} BoardRow */
/** @typedef {{activeRows: BoardRow[], counts: Record<string, number>}} ParsedBoard */

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function parseBoard(text) {
  const activeSection = text.includes("\n## Completed")
    ? text.slice(0, text.indexOf("\n## Completed"))
    : text;

  const rows = [];
  const counts = {};

  for (const rawLine of activeSection.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("|") || !line.includes(" | ")) continue;
    if (line.includes("Task ID") || line.includes("-----") || line.startsWith("| ----------------")) continue;

    const cols = line
      .split("|")
      .map((c) => c.trim())
      .filter((c, i, a) => i !== 0 && i !== a.length - 1);

    if (cols.length < 4) continue;

    const task = cols[0];
    const statusRaw = cols[1];
    const owner = cols[2];
    const scope = cols[4] ?? "n/a";
    const updated = cols.at(-1);
    if (!statusOrder.includes(statusRaw)) continue;

    const status = statusRaw.trim();
    counts[status] = (counts[status] ?? 0) + 1;
    rows.push({
      id: task.trim().split(/\s+/)[0],
      task: task.trim(),
      status,
      owner: owner.trim() || "unassigned",
      scope: scope?.trim() || "n/a",
      updated: updated?.trim(),
    });
  }

  return { activeRows: rows, counts };
}

function parseGoal(text) {
  const activeGoalSection = text.includes("## Active goal")
    ? text.slice(text.indexOf("## Active goal"), text.includes("## Achieved") ? text.indexOf("## Achieved") : text.length)
    : text;

  const statusMatch = activeGoalSection.match(/\| \*\*Status\*\* \|\s*([^|]+)\|/);
  const conditionMatch = activeGoalSection.match(/\| \*\*Condition\*\* \|\s*([^|]+)\|/);
  const turnRows = activeGoalSection
    .split("\n")
    .filter((line) => /^\|\s*\d+\s*\|/.test(line.trim()));

  const latestTurn = turnRows.at(-1) || "none";
  const parts = `${latestTurn}`.split("|").map((value) => value.trim());
  const rawLastTurn = parts.length >= 3 ? parts[2] : `${latestTurn}`;
  const lastTurn = rawLastTurn && rawLastTurn.length > 180 ? `${rawLastTurn.slice(0, 177).trim()}…` : rawLastTurn;

  return {
    status: statusMatch && statusMatch[1] ? statusMatch[1].trim() : "unavailable",
    lastTurn: lastTurn || "none",
    condition: conditionMatch && conditionMatch[1] ? conditionMatch[1].trim() : "unavailable",
  };
}

function formatLine(text) {
  return text.replace(/\s+/g, " ").trim();
}

function byStatus(rows, status) {
  return rows.filter((r) => r.status === status);
}

function chooseNextAction(rows) {
  const priority = ["blocked", "review", "in-progress", "queued", "done"];
  for (const status of priority) {
    const hit = rows.find((row) => row.status === status);
    if (hit) return hit;
  }
  return null;
}

/** Structured payload consumed by the pi-web heartbeat packet builder. */
function buildJson({ board, goal, next }) {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    board: {
      counts: board.counts,
      blocked: byStatus(board.activeRows, "blocked"),
      queued: byStatus(board.activeRows, "queued"),
      inProgress: byStatus(board.activeRows, "in-progress"),
      review: byStatus(board.activeRows, "review"),
    },
    goal,
    nextOwner: next ? { owner: next.owner, task: next.task, status: next.status } : null,
  };
}

/** Human-readable, tier-shaped output (default operational). */
function renderTier(tier, { board, goal, next }) {
  const activeCount = Object.values(board.counts).reduce((sum, count) => sum + count, 0);
  const lines = [];

  lines.push("FixFlags Agentic Engine Heartbeat", "--------------------------------");

  if (activeCount === 0) {
    lines.push("status: noop");
    return lines.join("\n");
  }

  lines.push(
    statusOrder
      .map((status) => `  ${statusEmojis[status]} ${status}: ${board.counts[status] || 0}`)
      .join("\n"),
  );

  if (tier === "operational" || tier === "daily") {
    const pressure = [...byStatus(board.activeRows, "blocked"), ...byStatus(board.activeRows, "queued")];
    lines.push("\nBacklog pressure (blocked/queued):");
    if (pressure.length) {
      for (const row of pressure.slice(0, 6)) lines.push(`  - ${row.task} [${row.status}] owner=${row.owner}`);
    } else {
      lines.push("  none (no blocked or queued tasks in active board)");
    }
  }

  if (tier === "daily" || tier === "weekly") {
    lines.push(`\nActive goal status: ${goal.status}`);
    lines.push(`Last logged turn: ${formatLine(goal.lastTurn)}`);
  }

  if (tier === "weekly") {
    lines.push("\nNext owner actions (active):");
    for (const row of board.activeRows.filter((r) => r.status === "blocked" || r.status === "queued")) {
      lines.push(`  - ${row.task} [${row.status}] owner=${row.owner} updated=${row.updated || "?"}`);
    }
  }

  if (next) {
    lines.push("\nNext owner action:", `  ${next.task} (${next.status})`, `  Owner: ${next.owner}`);
  } else {
    lines.push("\nNext owner action: none (no actionable rows found)");
  }

  return lines.join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  const tierArg = argv.find((a) => a.startsWith("--tier="));
  const tier = tierArg ? tierArg.split("=")[1] : argv.includes("--tier") ? argv[argv.indexOf("--tier") + 1] : null;
  const tierName = ["operational", "daily", "weekly"].includes(tier) ? tier : "operational";

  const boardText = readFileSafe(boardPath);
  if (!boardText) {
    if (asJson) {
      console.error(JSON.stringify({ ok: false, error: "Could not read .agents/BOARD.md from: " + boardPath }));
    } else {
      console.error("Could not read .agents/BOARD.md from:", boardPath);
    }
    process.exitCode = 1;
    return;
  }

  const board = parseBoard(boardText);
  const goal = goalPath ? parseGoal(readFileSafe(goalPath)) : { status: "unavailable", lastTurn: "none", condition: "unavailable" };
  const next = chooseNextAction(board.activeRows);

  if (asJson) {
    console.log(JSON.stringify(buildJson({ board, goal, next }), null, 2));
    return;
  }

  console.log(renderTier(tierName, { board, goal, next }));
}

main();
