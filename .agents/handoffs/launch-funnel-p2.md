# Launch funnel P2 — deferred until baseline

**Status:** deferred  
**Gate:** ~100 completed scan attempts + funnel rates from P0 analytics  
**Depends on:** launch-funnel-p0 (P0/P1 shipped)

## Do not build until data exists

After a controlled campaign produces roughly 100 completed scans, pick up:

1. **Audience-specific landing pages** — AI shipper vs existing site owner variants (see `.cursor/skills/fixflags-marketing/audiences.md`). Do not dilute the homepage further before conversion baselines.
2. **Authentic testimonials / case studies** — finding → action → outcome, with permission. Replace `LANDING_PAGE.productEvidence` only when real quotes exist.
3. **Agency sharing workflow** polish and repo/MCP connection CTAs.
4. **Scheduled monitoring** productization (user-facing “Monitor”; keep API `ff_monitoring` / `MonitoringMode` as-is until then).
5. **Magic link auth** if signup funnel shows password friction.
6. **Deeper evidence-type system** (waterfall, a11y tree, interaction traces) beyond shareable-check social previews.
7. **Optional display rename** Critical → Blocking only if research shows label distrust.

## North-star metric

% of completed scans where the user copies a fix and later re-checks.

## Campaign planning targets (not benchmarks)

| Step | Early target |
|------|----------------|
| Land → submit | 15–25% |
| Start → usable result | >85% |
| Result → finding interaction | >60% |
| Result → signup | 20–35% |
| Signup → fix copied | >50% |
| Fix copied → re-check ≤7d | 10–20% |

## Measure scan duration before claiming minutes

```bash
npx tsx scripts/measure-scan-duration.ts
```

Do not put “Usually ready in X–Y minutes” on the hero until median/p90 are reviewed.
