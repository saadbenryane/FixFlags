---
name: fixflags-completeness
description: Repeatable completeness, consistency, and docs-accuracy pass for FixFlags. Use when auditing whether work is truly done, eliminating doc drift, fixing silent UX failures, or closing verification gaps. Triggers on completeness pass, docs accuracy, verify green, drift audit, ship readiness.
---

# FixFlags Completeness Pass

**Read [`AGENTS.md`](../../AGENTS.md) first.** This skill encodes a repeatable workflow; canonical facts live in AGENTS.md only.

## When to run

- After a large refactor or pre-ship audit
- When docs and code may have drifted
- Before claiming `npm run verify` green or "work complete"

## Phase 1 — Automated gates

```bash
npm run typecheck
npm run lint
npm run brand:hex-guard
npm run ui:drift-guard
npm run seo:guard
npm run test:unit   # record count; never hardcode in docs
npm run build
npm run worker:build
```

Local full gate (requires Docker + `.env.local`):

```bash
docker compose up -d && npm run setup && npm run verify
```

CI runs a **subset** of verify (no `db:validate`/`db:check`/`db:drift`). Document this split; do not claim CI runs full verify.

## Phase 2 — Stale term grep

Search canonical docs and skills for:

| Term | Why stale |
|------|-----------|
| `888`, `1,629`, `1629` | Hardcoded test counts |
| `DEDUP_RULES` | Real dedup is `suppressOverlappingFlags()` |
| `STUDIO` plan | Schema is FREE/BUILDER/TEAM only |
| `/Users/saadbenryane/Code/qewos` | Use repo-relative paths |
| `CI is not on GitHub` | CI exists; claim must match `ci.yml` |
| `second pass` | Banned marketing phrase |
| `34 models`, `6 MCP tools`, `500 chars` prescription | See AGENTS.md Project facts |

## Phase 3 — Cross-check facts against code

| Fact | Source of truth |
|------|-----------------|
| Prisma models | `grep -c '^model ' prisma/schema.prisma` |
| Check modules | `lib/audit/checks/index.ts` `checkers[]` |
| Check IDs | `lib/audit/check-ids.ts` `ALL_CHECK_IDS` |
| MCP tools | `lib/mcp/tools.ts` `server.tool()` |
| Page text limits | `lib/audit/page-text-limits.ts` |
| Pipeline version | `lib/audit/pipeline-config.ts` |

## Phase 4 — UX silent failure audit

In product UI (not pipeline parse fallbacks), grep for:

- Empty `catch {}` without user feedback
- `fetch` without `res.ok` + `parseApiErrorResponse`
- Pagination `hasMore` hardcoded `true`
- Hand-rolled `rounded-lg border` panels (use `Card`/`Surface`/`Callout`)

## Phase 5 — Doc alignment

- `test-strategy.md` ↔ `QUALITY.md` blocker ratings must agree
- `ROADMAP.md` Now section reflects QUALITY evidence
- Skills cross-link AGENTS.md; no duplicated volatile counts
- `lib/audit/page-text-limits.ts` is canonical for 2500/5000 limits

## Phase 6 — Billing test coverage

Core scan endpoint must have route tests:

- `app/api/checks/__tests__/route.test.ts` — 402 paths + 201 success
- Mirror pattern from `app/api/api-keys/__tests__/route.test.ts`

Re-checks are never gated (separate route; document in test comments).

## Definition of done

- [ ] All Phase 1 commands pass (verify green locally if DB available)
- [ ] Phase 2 grep clean in canonical docs/skills
- [ ] Phase 3 facts match code
- [ ] No silent UX failures in touched surfaces
- [ ] `test-strategy.md` aligned with `QUALITY.md`
- [ ] Skills updated; `lean-visual.md` exists for UI passes

## Companion skills

- `fixflags-product` — entitlements, billing, pipeline behavior
- `fixflags-design-system` + `fixflags-marketing/lean-visual.md` — token compliance
- `fixflags-ui-upgrade` — orchestrator for visual polish
