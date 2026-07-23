# Strategic sprint completion plan

Status: completed in branch `cursor/strategic-sprint-39f0`.

## Phase 1 — Strategic bets (shipped)

| Bet | Outcome |
|-----|---------|
| Preview scan access | Agency project credentials, encrypted storage, Playwright + fetch threading |
| CI gate | GitHub Action + Vercel webhook |
| Lovable/Bolt UX | Hero copy, tool inference, `/partners` |
| Unified Finish Plan | Live + repo flags via `buildUnifiedFinishPlan` |
| MCP hardening | Quality gate script |

## Phase 2 — Completion pass (shipped)

| Gap | Fix |
|-----|-----|
| Scan access incomplete in pipeline | Journey, flow, critical-path, visual side-by-side |
| Finish Plan drift | MCP tools, export menu, report state use unified loader |
| Vercel webhook auth | `?apiKey=` query param (Vercel cannot send custom headers) |
| GitHub Action outputs | `report_id`, `report_url` declared |
| Agency API gate | `canScanRepositories` on scan-access routes |
| Partners discoverability | Nav footer, sitemap, SEO registry |
| Help + PRODUCT drift | Preview access + CI documented; contradictory constraints removed |
| Tests | `scan-access` route + `vercel` webhook route tests |

## Verification checklist

```bash
npm run test:unit -- lib/audit/__tests__/scan-access.test.ts lib/audit/__tests__/unified-finish-plan.test.ts
npm run test:unit -- app/api/projects/[id]/scan-access/__tests__/route.test.ts app/api/webhooks/vercel/__tests__/route.test.ts
npm run mcp:quality-gate
npm run agent -- verify
```

## Follow-ups (not blocking this sprint)

- CLI `scanAccess` flag for protected previews in CI
- Broader route-contract coverage beyond critical paths
- White-label / team workspaces (roadmap)
