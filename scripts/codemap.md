# scripts/ — Repository Automation

## Responsibility
CLI scripts for demo audits, backfills, guard enforcement, validation planning, and utility tasks.

## Entry Points
| File | Purpose |
|------|---------|
| `validate.mjs` | Changed-file-aware validation planner (quick/affected/full) |
| `brand-hex-guard.mjs` | Fails if raw hex colors appear outside allowed brand files |
| `ui-drift-guard.mjs` | Flags design-system drift (font-display, rounded-xl, micro sizes) |
| `seo-guard.mjs` | Ensures SEO route registry aligns with copy.ts and llms.txt |
| `demo-fixture-audit.ts` | Demo fixture audit (CLI, no server) |
| `demo-fixture-flow-audit.ts` | Flow audit on demo fixture |
| `audit-capability-report.ts` | Check module coverage report |

## Validation Planner (`validate.mjs`)
Three modes based on git diff:
- **quick:** Lint changed TS files + typecheck only (fast feedback for small changes)
- **affected:** Expand to dependent areas + full typecheck (e.g., `lib/audit/` change runs audit tests)
- **full:** All checks (current `npm run verify` behavior)

File-to-scope mappings:
- `lib/audit/` → audit tests + typecheck
- `lib/queue/` → queue tests + typecheck
- `lib/billing/` → billing tests + typecheck
- `components/` → UI typecheck
- `app/` → full typecheck
- `prisma/` → full validation

## Guard Scripts
| Script | What it checks |
|--------|----------------|
| `brand-hex-guard.mjs` | No raw hex in `app/`, `components/`, `lib/` (allowed: `tokens.css`, `brand-spec.ts`, `app/demo/`, `lib/prompts/`, `lib/audit/capture/`) |
| `ui-drift-guard.mjs` | No `font-display` outside marketing/pricing; no `rounded-xl`/`rounded-lg` on panel shells; no arbitrary micro font sizes (`text-[10px]`, `text-[11px]`, `text-[12px]`) |
| `seo-guard.mjs` | SEO keys in `copy.ts` match `INDEXABLE_ROUTES` in `seo-routes.ts`; `LLMS_SECTIONS` includes required paths |

## Demo & Smoke Scripts
- `demo-fixture-audit.ts` — Audit a frozen HTML fixture (offline, no server)
- `demo-fixture-flow-audit.ts` — Flow audit on demo fixture
- `smoke-triage-prod.ts` — Post-deploy production smoke test

## Backfill Scripts
- `backfill-leads.ts` — Backfill leads table
- `graph/` — Knowledge graph backfill scripts
- `growth/` — Growth analytics scripts

## Integration
- **Used by:** CI (`.github/workflows/ci.yml`), `npm run verify`, local development
- **Depends on:** Node.js, git CLI, Prisma CLI
- **Test coverage:** Script tests in `scripts/*.test.mjs` (if added)
