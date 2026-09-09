# Site interface contract

**TARGET.** Behavior: [PRD](product-prd.md). IA: [product-architecture.md](product-architecture.md). Intent: [vision](../knowledge/vision.md). Language: [voice-and-copy.md](voice-and-copy.md). Plan: [product-masterplan.md](product-masterplan.md). Tokens: [DESIGN.md](../DESIGN.md). Current report routes retain their [legacy contract](../knowledge/report-contract.md) during migration.

This file owns progressive states, Flag detail, and interaction quality. If navigation or object names disagree with [product-architecture.md](product-architecture.md), the architecture wins.

## One persistent place

First analysis loads directly into the Site shell and becomes its dashboard. Preserve identity and useful discoveries across loading, completion, refresh, retry and account claim. No disposable report followed by another workspace.

Design mobile-first. Desktop reveals more information using the same mental model and routes.

## Primary navigation

Customer chrome follows [product-architecture.md](product-architecture.md). Do not organize around scans, reports, audits, or an Agent tab.

| Destination | Customer question | Contents |
| --- | --- | --- |
| Home | How is the Site doing? | Card board: Pages, Journeys/Conversion, other categories, Flag counts and useful metrics |
| Flags | What needs me? | Prioritized attention; resolved history without polluting current attention |
| Site settings | How is this Site configured? | Watch, notifications, connections, danger zone. Not a third product mode |
| FixFlags Agent | Ask FixFlags | Persistent FAB (later). Not a nav item. Can escalate to support |

Account, billing and Site switching are supporting controls. Pages and Journeys are reached through cards unless they later earn a destination. No Agent | Report split, scores-first hero, raw-check grid, arbitrary dashboard builder or integration marketplace.

**Today's local tabs** Dashboard · Flags · Site are a stepping stone. Retire the third primary tab once settings exist. Mobile: Home · Flags · More.

## Home hierarchy

The [card-board experience](card-board-experience.md) is the detailed design source. Home/Dashboard is one flat customizable grid. The first card is Pages (explored pages of the Site). Security, Search, Performance, Conversion and Tracking form the rest of the initial board. A quiet Add card opens the personalized library; categories belong only there. Public evidence works before connections, which enrich these same cards.

Site identity and a human status lead. Journeys provide meaning. Attention appears as Flags when needed; a healthy Site can remain short and quiet (0 Flags, with coverage still discoverable). Always make coverage and freshness discoverable near health language.

Do not force a green overall label when an important Journey is unverified or stale. A site can be reachable while a purchase behavior is failing. Distinguish those facts. Numeric scores may explain a specific measurement in detail; they do not define Site health.

## Journey and Page

Use understandable Journey names (internal model may remain Outcome) and the smallest useful confirmation. Looks right / Edit corrects inferred intent; it is not a funnel-design task. Preserve edited understanding across future analysis.

Show relevant pages/actions and verification limits on expansion. A page may belong to multiple Journeys or none. Pages outside Journeys remain checkable. Coverage lists actual responsibility and gaps without hundreds of toggles.

## Flag detail

Start with what happened and where. Show certainty, impact explanation, evidence and Fix this. Add context and technical detail progressively. Evidence matches the claimed page, viewport and time; missing evidence has an honest state.

Fix this may expose Send a Flag to your AI, Share and View technical details. Keep fix instructions and safe export structured around reproduction, expected result and verification criteria. Never automatically message another person or tool.

Verify fix shows real progress and retains prior attempts. Resolved shows fresh independent proof and time. Neither copying nor “Done” resolves the Flag.

## State requirements

| State | Required presentation |
| --- | --- |
| Learning | Persisted discoveries and genuine running work; no generic fake progress or invented results |
| Partial | Useful confirmed facts plus explicit missing scope; retry where possible |
| Healthy | 0 Flags for that scope, plus a useful metric; coverage and latest verification remain available |
| Flags present | Ranked meaningful Flags (counts, not “Needs attention” prose); Recommendations stay in the card, not in notifications |
| Couldn't verify | What prevented a reliable answer and useful recovery/context action |
| Stale or delayed | Last known evidence distinguished from current coverage; never quietly green |
| No Journey inferred | Useful page checks plus lightweight intent correction; no fabricated journey |
| 0 Flags | Successful attention state when coverage supports it; not omniscience; Recommendations may still exist |
| Fix verification | Running, persistent failure, inconclusive, verified recovery and recurrence |
| Watch activation | Account/claim progress and actual scheduling result; retry activation independently of login |
| Connection absent/revoked | Existing answer remains usable; missing context explicit |
| Error | Preserve Site/history and offer recovery; no dead-end alternate report page |

## Connections and history

Offer context where its purpose is obvious: commerce inside Buy, Search Console beside a search concern, Meta beside a paid landing page. The Site settings area can manage connections but should not become a logo marketplace.

Show significant changes and recoveries with source/time. Avoid event-log noise in Home. Deployment correlation is phrased as timing until evidence supports causality.

## Visual and interaction quality

Keep approved brand tokens and existing accessible primitives. Replace decorative review/how-it-works art with real Site and Flag proof when available. No fake examples presented as live customer output.

Use clear focus order, 44px touch targets, status text alongside color, readable text, keyboard access, reduced motion and loading announcements without excessive screen-reader chatter. Verify at 375, 768 and 1280px, plus zoom/reflow. Desktop must not add essential actions unavailable on mobile.
