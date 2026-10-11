---
status: canonical
authority: interface
reviewed_at: 2026-10-09
supersedes: []
---

# Site interface contract

**TARGET.** Behavior: [PRD](product-prd.md). IA: [product-architecture.md](product-architecture.md). Intent: [vision](../knowledge/vision.md). Language: [voice-and-copy.md](voice-and-copy.md). Plan: [product-masterplan.md](product-masterplan.md). Tokens: [DESIGN.md](../DESIGN.md). Current report routes retain their [legacy contract](../knowledge/report-contract.md) during migration.

This file owns progressive states, Flag detail, and interaction quality. If navigation or object names disagree with [product-architecture.md](product-architecture.md), the architecture wins.

## One persistent place

First analysis loads directly into the Site shell and becomes its dashboard. Preserve identity and useful discoveries across loading, completion, refresh, retry and account claim. No disposable report followed by another workspace.

Design mobile-first. Desktop reveals more information using the same mental model and routes.

## Primary navigation

Customer chrome follows [product-architecture.md](product-architecture.md). Do not organize around scans, reports, audits, or an Agent tab.

| Destination    | Customer question                                   | Contents                                                                                         |
| -------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Websites       | Which websites are mine?                            | Full-width Site rows at `/dashboard`, preceded by one persistent Analyze control                    |
| Site Overview  | What works and what needs fixing on this website?  | Site identity, monitoring, visible recovery, and a prioritized grid of category summary cards       |
| Flags          | What needs me?                                      | An in-place view of every open Flag in the same Site dashboard                                    |
| Monitoring     | What has changed over time?                          | Monitoring state, cadence, Flag trend, and a useful event timeline                                |
| Integrations   | Which tools add context?                             | Supported connections with recognizable logos and plain status                                    |
| Site settings  | How is this Site configured?                        | Outcomes and coverage, monitoring, notifications, actionable connections, and Remove Site          |
| Ask FixFlags   | Explain this evidence                               | Contextual action at Site or Flag depth, never persistent global chrome                              |

Account, billing and Site switching are supporting controls. Outcomes and Flags are primary content; Pages, Journeys, category health and execution diagnostics are depth. No Agent | Report split, scores-first hero, raw-check grid, arbitrary dashboard builder or integration marketplace.

The selected Site uses Overview, Flags, Monitoring, Integrations, and Settings on desktop and mobile, with All websites as the return action. Flags, Monitoring, and Integrations are views of the same Site dashboard, not separate report products. Production verification remains separate from local implementation. Pages, Journeys and diagnostics stay inside card depth rather than becoming permanent navigation destinations.

## Home hierarchy

The [card-board experience](card-board-experience.md) owns the selected Site's flat grid. Show confirmed concrete visitor-action cards and scoped website-health cards together; preserve their different evidence semantics. Do not render an empty Outcomes heading. One compact Add action in the Site header offers real Outcome, coverage, and configured-connection options. Public evidence works before connections, which enrich the same product.

Site identity, monitoring, and one current result lead. The Flag count is that result only when Flags exist or the evidence is current and clear. Incomplete scope and its recovery action remain visible. Execution detail appears only while work is running, interrupted, partial, or failed. Completed pipeline narration does not remain on Overview. Attention appears inside the related category card, where every Flag is its own action row. The Flags navigation item switches the same dashboard to the complete open list. A quiet Site still supplies scope and freshness in card depth.

## Shared board rules

- The homepage sample and authenticated Site use the same summary, category-row, technology, monitoring, and integration components.
- Summary cards communicate a result or useful operating state. Never use filler counts such as “With 0 Flags,” “Still to check,” “Review areas,” or “Daily schedule.” Prefer Flags, Areas checked, and Daily monitoring active.
- Put relative freshness, the total Flag count, and the status dot at the top right of each category card. Category rechecking belongs in the detail modal. Keep the dot farthest right and align each Flag arrow directly below its center, with no extra right padding on Flag rows. Highlight each Flag row on hover or keyboard focus.
- Summary and clear categories stay borderless. Put a single orange outline around each flagged category, with no individual Flag outlines or orange backgrounds. Each Flag has its own right-aligned arrow and copy shortcut, visible on hover or keyboard focus and always available on touch screens.
- Clear category rows show only the name, green icon, and status controls. Opening them reveals the complete check list. Flagged categories use orange icons.
- Flag titles name observable failures, such as a page not loading, a measured slow page, or a missing payment form. Detection alone never establishes private integration configuration such as test keys. Flag rows use an orange dot, left indentation, and a hover surface without underlining. Areas checked opens the enabled checks and supported additions.
- Preserve overall status and total Flags next to the Site identity. The preview menu omits the duplicate Flags destination.
- After copying a prompt, show a temporary bottom-center confirmation with a countdown bar and a Set up MCP link to `/dashboard/mcp-setup`.
- A detected-technology strip sits before the summary. Use the real product logo when available and pair color with a text state. “Detected” describes evidence of use, not proof that the tool works. A detected tool may become a suggested integration for more data and checks, but it is not connected until the customer connects it.
- Monitoring owns cadence, a Flag-per-check graph when run history supports it, and a short Flag or recovery timeline. Do not fabricate trend points before two completed checks exist.
- Monitoring and Integrations replace the board content inside the persistent Site shell. They do not open in a modal.
- Integrations use recognizable logos and plain states such as Connected, Suggested, or Available. Connections add context and do not establish recovery.
- Do not use horizontal or vertical divider lines. Use spacing, surface tone, type, and flagged-category outlines to establish hierarchy. A temporary countdown bar communicates confirmation duration.

Do not force a green overall label when an important Outcome is unverified or stale. A Site can be reachable while Checkout fails. A security or HTTP signal can fail without proving Checkout failed. Distinguish Outcome health from raw signal/category health.

## Outcome, Journey and Page

Use concrete Outcome names such as Checkout and Signup and the smallest useful confirmation. A Journey is one browser path underneath a human-facing Outcome. Looks right / Edit corrects inferred intent; it is not a funnel-design task. Preserve edited understanding across future analysis.

Show expectation, state, freshness, related pages/actions, execution methods and verification limits on expansion. A page may contribute to multiple Outcomes or none. Pages outside Journeys remain checkable. Coverage lists actual responsibility and gaps without hundreds of toggles.

## Flag detail

Start with what happened and where. Show affected scope, observed behavior, expected behavior, evidence, and limitations. Add technical detail progressively. Evidence matches the claimed page, viewport and time; missing evidence has an honest state.

Copy fix prompt is the single coding-tool handoff. Ask FixFlags is reserved for grounded product explanation. Keep fix instructions structured around reproduction, expected result and verification criteria. Never automatically message another person or tool.

Verify fix shows real progress and retains prior attempts. Resolved shows fresh independent proof and time. Neither copying nor “Done” resolves the Flag.

## State requirements

| State                     | Required presentation                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Learning                  | Persisted discoveries and genuine running work; no generic fake progress or invented results                          |
| Partial                   | Useful confirmed facts plus explicit missing scope; retry where possible                                              |
| Healthy                   | 0 Flags for that scope, plus a useful metric; coverage and latest verification remain available                       |
| Flags present             | Ranked meaningful Flags (counts, not “Needs attention” prose); Recommendations stay in the card, not in notifications |
| Couldn't verify           | What prevented a reliable answer and useful recovery/context action                                                   |
| Stale or delayed          | Last known evidence distinguished from current coverage; never quietly green                                          |
| No Journey inferred       | Useful page checks plus lightweight intent correction; no fabricated journey                                          |
| 0 Flags                   | Successful attention state when coverage supports it; not omniscience; Recommendations may still exist                |
| Fix verification          | Running, persistent failure, inconclusive, verified recovery and recurrence                                           |
| Watch activation          | Account/claim progress and actual scheduling result; retry activation independently of login                          |
| Connection absent/revoked | Existing answer remains usable; missing context explicit                                                              |
| Error                     | Preserve Site/history and offer recovery; no dead-end alternate report page                                           |

## Connections and history

Offer context where its purpose is obvious: commerce inside Buy, Search Console beside a search concern, Meta beside a paid landing page. The Integrations view lists supported connections and their status with real logos. Site settings manages connection configuration without becoming a logo marketplace.

Show significant changes and recoveries with source/time. Avoid event-log noise in Home. Deployment correlation is phrased as timing until evidence supports causality.

## Visual and interaction quality

Keep approved brand tokens and existing accessible primitives. Replace decorative review/how-it-works art with real Site and Flag proof when available. No fake examples presented as live customer output.

Use clear focus order, 44px touch targets, status text alongside color, readable text, keyboard access, reduced motion and loading announcements without excessive screen-reader chatter. Verify at 375, 768 and 1280px, plus zoom/reflow. Desktop must not add essential actions unavailable on mobile.
