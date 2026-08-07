# Anon funnel verify + GradLoom dogfood

**Date:** 2026-08-06  
**Owner:** pi-agent  
**Target:** https://gradloom.app (Lovable-built SaaS)

## 1) Anon funnel P1s

Already shipped on main (launch-promise closeout). Verified green:

| Item | Status | Evidence |
|------|--------|----------|
| Anon retry cookie gate | shipped | `canRetryAnonymousAudit` + retry route tests pass |
| Anon `ff_get_report` | shipped | `lib/mcp/anon-check-status.ts` registers teaser `'one'` access |
| failedModules persist + callout | shipped | finalize + AuditReport callout + persist tests |
| Demonstrated fix agent-shaped | **closed this session** | `buildFixList` now uses `buildExpertFixPrompt` when a prompt is shown |

## 2) Dogfood (deterministic; AI blocked)

Local OpenAI key returns **401**, so runs are `reportCompleteness: PARTIAL` (no AI prescription). Deterministic path still useful.

### Fresh production-path audit after fixes

- **Report:** `cmshooudu0001gpmbdgjd605s`
- **Score:** 76
- **Distinct fixes:** 8
- **Anon demonstrated prompt:** 1, expert-shaped (`## Why` / `## Fix`) on `slow-3g-blank-screen`

| checkId | Severity | Verdict |
|---------|----------|---------|
| slow-3g-blank-screen | CRITICAL | TP — ~13s blank on simulated 3G |
| hierarchy-competing-actions | IMPORTANT | TP — dual hero CTAs |
| friction-no-commitment-path | IMPORTANT | TP — no trial/demo/pricing path |
| trust-unsupported-claims | IMPORTANT | TP-ish — superlatives without numbers |
| mobile-perf-poor | IMPORTANT | TP — PageSpeed ~73 |
| friction-no-social-proof | POLISH | TP |
| measurement-ga-gtm-posthog-missing | POLISH | TP |
| security-headers-missing | POLISH | TP |

### False positives killed this session

1. **flow-cta-unclickable** on same-page button CTAs — navigation race treated working `onclick` buttons as unclickable.  
   Fix: skip navigation wait when href is empty/hash; bound click separately from nav wait (`lib/audit/flow/run-flow-scan.ts`).

2. **overlay-blocks-cta** from probe residue — multi-step form probe opened GradLoom “Saved Career Paths” auth dialog, then primary CTA click hit the leftover modal.  
   Fix: `dismissOpenDialogs()` after multi-step probes (`lib/audit/browser/overlay-probe.ts` + flow scan).

Standalone flow after fix: `status: success`, zero flow flags.

### Earlier noisy runs (for trail)

- `cmshocwnl0001gpnbkc46agv7` — baseline with unclickable FP  
- `cmshoi1jy0003gpnbsigynvdy` — still unclickable (worker stale)  
- `cmshok45x0001gpqu79c2j8cm` — unclickable gone, overlay FP  
- `cmshooudu0001gpmbdgjd605s` — clean (post dismiss)

## 3) Not verified

- Full AI judge path (bad `OPENAI_API_KEY` in `.env.local`)
- Anon retry e2e in browser (unit coverage only)
- CLI `--wait` live slow path
- Production release proof

## 4) Operator action

Rotate / fix OpenAI API key in `.env.local` so dogfood can include AI prescription quality.
