# Roadmap

*Repository-level direction. Not a duplicate of external tracker.*

## Now

- **Monetization blockers** — close 5 BLOCKER items from test-strategy.md:
  1. Real-site regression fixtures in CI
  2. AI judge contract validation
  3. Persist layer tests
  4. Pipeline state machine tests
  5. Billing gating enforcement
  *Signal:* Ads can run without risking customer trust.

- **Scan depth Phase 1** — per scan-roadmap.md Phase 1. The validated exception to the zero-features freeze.

## Next

- **Growth distribution** — improve conversion from anonymous → signed-up → paying:
  - Smooth onboarding flow
  - Better upsell timing and copy
  - Re-engagement for users who exhausted free checks
  *Signal:* >5% free-to-paid conversion.

- **Knowledge graph Phase 2** — deeper issue frequency pages, more benchmark content.
  *Signal:* Organic traffic from issue pages exceeds homepage traffic.

- **MCP polish** — Lovable/Bolt MCP support, tool refinements.
  *Signal:* MCP is reliable across all supported editors.

## Later

- **CI/CD integration** — GitHub Actions, Vercel deploy hooks. Runs audit on deploy preview.
  *Trigger:* Agency plan users requesting it.
- **Team workspaces** — seat management, shared projects, audit history.
  *Trigger:* 10+ Agency subscribers.
- **Staging site support** — password-protected or localhost URL testing.
  *Trigger:* Feature request volume justifies complexity.
- **White-label reports** — branded PDF exports, custom domains.
  *Trigger:* Agency demand.

## Not planned

- Enterprise compliance reports (SOC2, HIPAA)
- Custom rubric creation
- Batch/API scanning for non-MCP use
- Desktop/mobile apps
- AI model training on user data
- Bug bounty program
- On-premise deployment

## Completion signals

| Item | Signal |
|------|--------|
| 100 paying users | Monetization blockers closed, conversion >5% |
| Growth distribution | Organic traffic > paid acquisition |
| Agency viability | 10+ Agency subscribers, CI/CD integration live |
| Product-market fit | >20% MoM paid user growth for 3 consecutive months |
