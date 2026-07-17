# FixFlags Completeness Pass

**Read `AGENTS.md` first.** Use when verifying work is complete or before shipping.

## Phase 1: Automated gates

```bash
npm run typecheck
npm run lint
npm run brand:hex-guard
npm run ui:drift-guard
npm run seo:guard
npm run test:unit
```

All must pass with zero errors before claiming done.

## Phase 2: Stale term grep

Search docs and code for stale terms:

| Term | Why stale |
|------|-----------|
| `888`, `1629` | Hardcoded test counts |
| `DEDUP_RULES` | Real dedup is `suppressOverlappingFlags()` |
| `STUDIO` plan | Schema is FREE/BUILDER/TEAM only |
| `second pass` | Banned marketing phrase |
| `34 models` | Schema has 40 models |
| `500 chars` prescription | Prescription is 5000 chars |

## Phase 3: Cross-check facts

| Fact | Source of truth |
|------|-----------------|
| Prisma models | `grep -c '^model ' prisma/schema.prisma` |
| Check modules | `lib/audit/checks/index.ts` `checkers[]` |
| Check IDs | `lib/audit/check-ids.ts` `ALL_CHECK_IDS` |
| MCP tools | `lib/mcp/tools.ts` `server.tool()` |
| Pipeline version | `lib/audit/pipeline-config.ts` |

## Phase 4: UX audit

- No empty `catch {}` without user feedback
- No `fetch` without `res.ok` handling
- No hand-rolled panels (use `Card`/`Surface`/`Callout`)
- All marketing copy from `copy.ts`
- No em dashes in rendered text

## Definition of done

- [ ] `npm run typecheck` -- zero errors
- [ ] `npm run lint` -- zero errors
- [ ] `npm run test:unit` -- all passing
- [ ] All guards pass
- [ ] No stale terms in touched files
- [ ] Facts match code
