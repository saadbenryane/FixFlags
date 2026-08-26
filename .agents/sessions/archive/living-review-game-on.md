# Living Review Game On

**Status:** in progress  
**Board:** `living-review-game-on`  
**Started:** 2026-08-16

## Condition

1. One immersive split shell for all live completed reports (ProductSpine inside Report mode).
2. Report pane restores Funnel/stack/contract/anon CTA/status/footer actions.
3. Progressive COMPLETED hold matches SSR composition.
4. `/samples` and homepage reuse shared living editor chrome.
5. Password-share hides Agent chat; dead dual-layout paths removed.
6. Docs/skills/learnings updated for regression prevention.

## Proof commands

```bash
npx vitest run components/report components/audit components/marketing lib/audit/__tests__/scan-agent-messages.test.ts --reporter=dot
npm run validate:quick
npm run ui:drift-guard
npm run agent -- verify
```

## Phases

- [ ] Phase 0 claim
- [ ] Phase 1 unify completed shell
- [ ] Phase 2 progressive parity
- [ ] Phase 3 samples + homepage
- [ ] Phase 4 share polish
- [ ] Phase 5 tests
- [ ] Phase 6 docs/skills
- [ ] Phase 7 verify
