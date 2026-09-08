# Homepage to Site without cheating — 2026-09-08

Homepage example and live Site board now share one information architecture.

## Done

- Starter names come from `CARD_CATALOG`: Site, Conversion, Security, Search, Performance, Tracking. Homepage first card is Site. Product Site card is named Site, not the host.
- Shared `BoardCard` / `BoardGrid` used by the homepage example and `SiteBoard`. Header carries status text + dot. Healthy uses `--success`, attention uses `--warning` amber, Flag/problem uses undiluted `--brand`. Conversion in problem state is the orange Flag card, not a second essay.
- Homepage no longer sells Add card or Connect MCP. Copy prompt remains. Example board, workflow evidence, and the watch stack stay labeled illustrative.
- Live Site card projects human status, `SitePage` count, Flag count, latest check, and an optional real desktop capture. Never a stock marketing PNG. Conversion problems link to the Flag page.
- Flag page is title, Needs a fix, supporting line, outcome, evidence, Fix this, Verify fix. Copy posts `action: copy` and does not resolve.
- Tests lock catalog names, Conversion Flag chrome, no Add/MCP, and copy-does-not-resolve. Public journey starts from homepage URL submit to `/sites/{id}` and asserts starter cards. Handoff still has no `/report` fallback.

## Proof

- Vitest: CareHomepage, board-card, card-areas, SiteFlagActions.
- Homepage board inspected at 375, 768, and 1280 on `localhost:3017`. No overflow. No Add card. Conversion sits beside Site at 768 and 1280.

## Not done

- Did not deploy.
- Did not run `E2E_FULL` against a live queue.
- Did not change marketing-care-alignment files or production ship.
