# Customer Executive Upgrade — 2026-08-10

**Timestamp:** 2026-08-10
**Task ID:** customer-exec-upgrade
**Owner:** pi-agent (customer executive)
**Branch:** main

## Objective link
CEO directive: "upgrade yourself accordingly as an agent and our agentic system to work." Serves the operating model objective (AI-native operating model, done 2026-08-09) by hardening the Customer executive loop.

## What landed
- `.agents/company/customer-exec-ops.md` — customer memory stack (BOARD/GOAL/knowledge/sessions/learnings), three worker personas (Signal Monitor, Backlog Prioritizer, Escalation Steward) with scope/modality/model/budget/success criteria, spawn contract template, weekly heartbeat packet spec.
- `.agents/company/customer-weekly-heartbeat.md` — CEO-ready weekly template: signals, objective progress, backlog pressure, decision need, one owner, strategic scan status, NO-OP rule.
- `.agents/company/customer-heartbeat-executor.md` — wake procedure (30-60 min heartbeat + weekly review), decision policy (founder escalation format), verification policy (proof over assertion), budget discipline (free-first).
- `.agents/company/README.md` — file map now references all three customer files.
- `.agents/learnings/customer-executive-upgrade.md` — durable learning entry.

## Verification
- Files written and cross-referenced. Board row claimed and marked done.
- `npm run agent -- verify` run for changed-file proof (see output below).

## Next action owner
**CEO** — approve the customer executive upgrade; then the customer executive runs the first weekly heartbeat using the new template.
