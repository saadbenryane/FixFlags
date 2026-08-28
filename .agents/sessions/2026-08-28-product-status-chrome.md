# Product status chrome

**Date:** 2026-08-28  
**Board:** `product-status-chrome`

## Shipped

1. Mobile Agent / Report tabs show `MessageSquare` + `FileText` icons (labels unchanged).
2. Update-review outcome cards removed from the report; they live on Product under the score chart via `latestUpdateDiff`.
3. Review history auto-scrolls right on load; Agent chat pins to the latest message.
4. Report contract + workspace-interface docs updated.

## Deploy

| Check | Result |
|-------|--------|
| Deploy SHA | `b3095d0239589ed017ed47e67c0c39f73dc4ce2b` |
| `/api/health` | Matched tip |
| Agent verify | Passed |
| CI full | Pre-existing marketing-trust / metadata failures (unrelated) |
