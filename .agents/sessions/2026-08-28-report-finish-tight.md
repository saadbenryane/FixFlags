# Report finish tight

**Date:** 2026-08-28  
**Board:** `report-finish-tight`

## Shipped

1. **Outcome cards** under Review history: Fixed / Still open / New / Regressed / Inconclusive (non-empty only). Fixed + Inconclusive info tooltips. No yellow hero.
2. **Compare removed** from report actions. `/compare/[id]` redirects to `/report/[id]` (Next `redirect`).
3. **Top Flags** kept. Coverage subtitle is `N public links` only; Partial honesty is an info tooltip.
4. **Flush canvas:** immersive backdrop off; Product pane opaque `bg-background`.
5. **Capture-comparable Fixed:** page COMPLETED when capture succeeds (PSI gaps keep completeness PARTIAL). Fixed no longer requires PageSpeed FULL. Multi-path and product-scoped gates unchanged. IMPROVED untouched.

## Deploy / dogfood

| Check | Result |
|-------|--------|
| Feature SHA | `6f4683e7967c7033d130c6c117a8fc46dba89a36` |
| Tip at close | `eaf0ee54175c151e39e2cec7f902b2f856332582` (em-dash + schema CI cleanups) |
| `/api/health` | Matched tip after Railway rolled |
| Before child | `cmtby9oky000dl720o44n3wfq` |
| Fresh Update review | **Owner action:** signed-in Update review on saadbenryane.com (CLI/MCP parked) |
| After Fixed count | _(fill after rescan)_ |

## Do not cheat

New Flags and slow-3G stay visible. Fixed only for pages that were re-run.
