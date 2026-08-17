# Full-Bleed Living Review Editor

**Status:** done  
**Board:** `fullbleed-living-review`  
**Started:** 2026-08-16  
**Completed:** 2026-08-16

## Condition

1. Full-bleed Agent | Product split with no pane cards; left thinner than right.
2. Scanning and completed share one shell; no hero-document jump.
3. Preview shows one device at a time with Desktop | Mobile toggle.
4. Homepage curated emulation uses Rooted / fixflags.com/demo and real WebPs.
5. Docs and skills describe the full-bleed living-review contract.

## Proof commands

```bash
npx vitest run components/report components/audit/__tests__/AuditReportProgressive.test.tsx components/marketing lib/audit/__tests__/scan-agent-messages.test.ts --reporter=dot
npm run validate:quick
npm run ui:drift-guard
npm run agent -- verify
```

## Evidence

- Focused suites: 158 passed
- `validate:quick` and `ui:drift-guard` green
- `npm run agent -- verify`: 11 affected commands passed
- Browser homepage at 375 / 768 / 1280: Rooted, fixflags.com/demo, device toggle, real demo WebP, no Plantdad

## Phases

- [x] Phase 0 claim
- [x] Phase 1 full-bleed no cards
- [x] Phase 2 one shell complete
- [x] Phase 3 device toggle
- [x] Phase 4 demo homepage
- [x] Phase 5 docs/skills
- [x] Phase 6 verify close
