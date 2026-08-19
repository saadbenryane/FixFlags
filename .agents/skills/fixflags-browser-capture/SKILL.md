---
name: fixflags-browser-capture
description: FixFlags Playwright browser capture — screenshots, flow scan, slow 3G replay, journey walks, network engagement, visual evidence. Use when changing capture, Chromium, network probes, or rejecting agentic MCP browsing. Triggers on Playwright capture, flow scan, slow replay, journey review, network monitor, screenshot, browser singleton.
---

# FixFlags browser capture

Read `AGENTS.md` first. **Playwright + Chromium only** on the audit path. Do not adopt chrome-devtools-mcp, chrome-devtools-axi, or conversational browser agents for scans.

**Pipeline skill:** `.agents/skills/fixflags-audit-pipeline/SKILL.md` for triage, finalize, and recovery.
**Journey design (aspirational vs shipped):** `docs/journey-review-architecture.md`

## Architecture

```
runner.ts → run-page.ts → captureScreenshots (screenshot.ts)
                       → runSlowReplay (primary page, budget permitting)
                       → runAllChecks + flow + network + slow-replay flags
runner.ts → runJourneyReviewsForAudit (Pro+, inline before finalize)
finalize-from-outcome.ts → visual evidence (graceful)
```

- **Singleton browser** per worker (`getAuditBrowser()`). Each capture/journey/slow-replay uses its **own browser context** and closes it when done.
- **Not agentic:** deterministic orchestration (CTA heuristics, template journeys). LLM JourneyPlanner is not built.
- **AXI applies elsewhere:** agent-facing CLI/MCP tooling (`fixflags-cli/`, `lib/mcp/tools.ts`, `scripts/project-agent.mjs`), not audit capture.

## Key files

| Area | Files |
|------|-------|
| Launch + pool | `lib/audit/screenshot.ts`, `app/api/health/browser/route.ts` |
| Page session | `lib/audit/browser/page-session.ts`, `capture-profile.ts` |
| Flow scan | `lib/audit/flow/run-flow-scan.ts`, `discover-cta.ts` |
| Slow 3G | `lib/audit/flow/slow-replay-probe.ts`, `checks/slow-replay.ts` |
| Journey | `lib/audit/journey/run-journey-reviews.ts`, `run-template.ts` |
| Network / forms | `lib/audit/browser/network-monitor.ts`, `journey-safety.ts` |
| Visual evidence | `lib/audit/capture/visual-capture.ts`, `persist-visual-evidence.ts` |
| Evidence overlay | `lib/audit/evidence-targets.ts` (harvest after screenshot + axe; persist on `Flag.evidenceTargets`) |
| Production path | `lib/audit/pipeline/run-page.ts` |

## Invariants

- Desktop screenshot is **required**; mobile/PageSpeed partial → `PARTIAL` completeness, not FAILED.
- Primary desktop capture with flow uses `journeySafe: true` for engagement POST probe (no real payment submits).
- `networkFailures` merges desktop + mobile sessions; cap at 40 per monitor.
- Slow replay runs on primary page when `deadline - now > SLOW_REPLAY_MIN_BUDGET_MS` (30s).
- Flow/journey/visual failures are swallowed; audit continues with honest degradation.
- `tooling-path-filter.ts` suppresses playwright-mcp `/tmp` artifact false positives.
- Overlay rectangles are harvested on the capture page immediately after the viewport screenshot. Never re-open the URL with generic CSS to guess a box. If the element was not measured, persist no element target.

## Verification

```bash
npm run test:unit -- lib/audit/__tests__/run-page-production-path.test.ts
npm run test:unit -- lib/audit/__tests__/beat-scout-precision.test.ts
npm run demo:audit:flow
curl -s http://localhost:3000/api/health/browser | jq .
npm run audit:capabilities
```

## Anti-patterns

- Replacing Playwright with chrome-devtools-mcp or AXI browser CLIs for production scans
- Sharing pages across concurrent operations within one audit
- Marking `experience-slow-replay` live without `run-page.ts` wiring
- Letting visual evidence or journey failures fail the audit job
- Using `deterministic-audit.ts` as the production entry (offline/demo probes only)
- Drawing a highlight from `ELEMENT_REGION_PRESETS` or a second-pass selector guess (`.demo-cta-primary`, `main`)
