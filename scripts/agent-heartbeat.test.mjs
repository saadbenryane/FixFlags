#!/usr/bin/env node
/**
 * Unit tests for the FixFlags company readout (scripts/agent-heartbeat.mjs).
 * Parses fixture BOARD/GOAL content through the script's --json mode and
 * asserts the deterministic payload shape consumed by the heartbeat packet.
 *
 * Usage:
 *   node scripts/agent-heartbeat.test.mjs
 *   npm run test:heartbeat
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "agent-heartbeat.mjs");

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  console.log(`  ok   ${name}`);
}

function bad(name, detail = "") {
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(cond, name, detail = "") {
  if (cond) ok(name);
  else bad(name, detail);
}

const FIXTURE_BOARD = `# Task Board

| Task ID               | Status      | Owner      | Branch/worktree | Scope         | Files/areas | Dependencies | Updated |
| --------------------- | ----------- | ---------- | --------------- | ------------- | ----------- | ------------ | ------- |
| task-one              | in-progress | agent-a    | main            | Scope A       | files-a     | none         | 2026-08-10 |
| task-two              | blocked     | agent-b    | main            | Scope B       | files-b     | dep-b        | 2026-08-09 |
| task-three            | done        | agent-c    | main            | Scope C       | files-c     | none         | 2026-08-08 |

## Completed

| Task ID      | Owner    | Scope | Completed |
| ------------ | -------- | ----- | --------- |
| old-task     | agent-x  | old   | 2026-07-01 |
`;

const FIXTURE_GOAL = `# Goal state

## Active goal

| Field | Value |
|-------|-------|
| **Condition** | Something complete. |
| **Status** | active |

## Turn log

| Turn | Work | Proof | Verdict | Reason |
|------|------|-------|---------|--------|
| 1 | Did a thing. | passed | PARTIAL | More to do. |
`;

function runReadout(cwd, args = []) {
  return execFileSync(process.execPath, [scriptPath, ...args], { cwd, encoding: "utf8" });
}

function runReadoutExpectFailure(cwd, args = []) {
  try {
    execFileSync(process.execPath, [scriptPath, ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;
    return { ok: false, message };
  }
}

function withFixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hb-readout-"));
  fs.mkdirSync(path.join(dir, ".agents"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".agents", "BOARD.md"), FIXTURE_BOARD);
  fs.writeFileSync(path.join(dir, ".agents", "GOAL.md"), FIXTURE_GOAL);
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

withFixture((dir) => {
  const out = JSON.parse(runReadout(dir, ["--json"]));
  assert(out.ok === true, "json: ok flag");
  assert(out.board.counts["in-progress"] === 1 && out.board.counts.blocked === 1 && out.board.counts.done === 1, `json: board counts (got ${JSON.stringify(out.board.counts)})`);
  assert(out.board.counts.done === 1, "json: completed section excluded from active counts");
  assert(out.board.blocked.length === 1 && out.board.blocked[0].id === "task-two" && out.board.blocked[0].owner === "agent-b", "json: blocked rows with id/owner");
  assert(out.board.queued.length === 0, "json: no queued rows in fixture");
  assert(out.goal.status === "active" && out.goal.condition.includes("Something complete"), "json: goal status + condition");
  assert(out.goal.lastTurn.includes("Did a thing"), "json: last logged turn captured");
  assert(out.nextOwner && out.nextOwner.task === "task-two" && out.nextOwner.owner === "agent-b", "json: next owner = first blocked row");
  assert(out.warnings.length === 0, "json: clean fixture produces no warnings");

  const human = runReadout(dir, ["--tier=weekly"]);
  assert(human.includes("🟡 in-progress: 1") && human.includes("🚫 blocked: 1"), "human: emoji counts");
  assert(human.includes("Active goal status: active"), "human: goal line in daily/weekly tiers");
  assert(human.includes("task-two [blocked] owner=agent-b"), "human: next owner action");

  const operational = runReadout(dir, ["--tier=operational"]);
  assert(!operational.includes("Active goal status"), "human: operational tier omits goal section");
});

withFixture((dir) => {
  const boardPath = path.join(dir, ".agents", "BOARD.md");
  const malformedBoard = [
    "# Task Board",
    "",
    "| Task ID               | Status      | Owner      | Branch/worktree | Scope         | Files/areas | Dependencies | Updated |",
    "| --------------------- | ----------- | ---------- | --------------- | ------------- | ----------- | ------------ | ------- |",
    "| task-two              | blocked     | agent-b    | main            | Scope B       | files-b     | dep-b        | 2026-08-09 |",
    "| malformed-row-no-status",
    "| task-one              | unknown     | agent-a    | main            | Scope A       | files-a     | none         | 2026-08-10 |",
    "| task-three            | done        | agent-c    | main            | Scope C       | files-c     | none         | 2026-08-08 |",
    "",
    "## Completed",
    "| Task ID      | Owner    | Scope | Completed |",
    "| ------------ | -------- | ----- | --------- |",
    "| old-task     | agent-x  | old   | 2026-07-01 |",
  ].join("\n");

  fs.writeFileSync(boardPath, malformedBoard, "utf8");
  const out = JSON.parse(runReadout(dir, ["--json"]));
  assert(out.board.counts["blocked"] === 1 && out.board.counts["done"] === 1, "json: malformed rows are ignored");
  assert(Array.isArray(out.warnings) && out.warnings.length >= 1, "json: malformed/invalid rows are surfaced in warnings");
});

withFixture((dir) => {
  fs.unlinkSync(path.join(dir, ".agents", "GOAL.md"));
  const out = JSON.parse(runReadout(dir, ["--json"]));
  assert(out.goal.status === "unavailable", "json: missing GOAL.md → explicit unavailable");
  assert(out.goal.warning === "GOAL.md is missing", "json: missing GOAL.md warning present");
});

withFixture((dir) => {
  fs.unlinkSync(path.join(dir, ".agents", "BOARD.md"));
  const result = runReadoutExpectFailure(dir, ["--json"]);
  assert(!result.ok, "json: missing BOARD.md exits with failure");
  assert(typeof result.message === "string" && result.message.includes("Could not read .agents/BOARD.md"), "json: missing BOARD.md surfaces read error");
});
console.log(`\nagent-heartbeat: ${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
