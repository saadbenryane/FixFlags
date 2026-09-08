# Site interface contract

**TARGET, 2026-09-08.** Replaces the report/chat interface specification. Behavior: [PRD](product-prd.md). Intent: [vision](../knowledge/vision.md). Tokens: [DESIGN.md](../DESIGN.md). Current report routes retain their [legacy contract](../knowledge/report-contract.md) during migration.

## One persistent place

First analysis loads directly into the Site shell and becomes its dashboard. Preserve identity and useful discoveries across loading, completion, refresh, retry and account claim. No disposable report followed by another workspace.

Design mobile-first. Desktop reveals more information using the same mental model and routes.

## Primary navigation

| Destination | Customer question | Contents |
| --- | --- | --- |
| Home | Does anything need me? | Bounded current status, important Outcomes, worthwhile open Flags, recent meaningful changes and last verification |
| Flags | What needs fixing? | Prioritized attention, clear scope/certainty and progressive detail; resolved history remains accessible without polluting current attention |
| Site | What is FixFlags responsible for? | Outcomes, pages/actions, coverage, connections, history and configuration |

Account, billing and Site switching are supporting controls, not competing product modes. No Agent | Report split, scores-first hero, raw-check grid, arbitrary dashboard builder or integration marketplace. Capability cards summarize meaning; underlying checks stay in progressive detail.

## Home hierarchy

The [card-board experience](card-board-experience.md) is the detailed design source. Home/Dashboard is one flat customizable grid with a permanent compact Site card. Security, Search, Performance, Conversion and Tracking form the initial board. A quiet Add card opens the personalized library; categories belong only there. Desktop uses Dashboard · Flags · Site; mobile uses Home · Flags · Site. Public evidence works before connections, which enrich these same cards.

Site identity and a human status lead. Important Outcomes provide meaning. Attention appears prominently when needed; a healthy Site can remain short and quiet. Always make coverage and freshness discoverable near health language.

Do not force a green overall label when an important Outcome is unverified or stale. A site can be reachable while a purchase behavior is failing. Distinguish those facts. Numeric scores may explain a specific measurement in detail; they do not define Site health.

## Outcome and Page

Use understandable Outcome names and the smallest useful confirmation. Looks right / Edit corrects inferred intent; it is not a funnel-design task. Preserve edited understanding across future analysis.

Show relevant pages/actions and verification limits on expansion. A page may belong to multiple Outcomes or none. Pages outside Outcomes remain checkable. Coverage lists actual responsibility and gaps without hundreds of toggles.

## Flag detail

Start with what happened and where. Show certainty, impact explanation, evidence and Fix this. Add context and technical detail progressively. Evidence matches the claimed page, viewport and time; missing evidence has an honest state.

Fix this may expose Send to my AI, Share and View technical details. Keep fix instructions and safe export structured around reproduction, expected result and verification criteria. Never automatically message another person or tool.

Verify fix shows real progress and retains prior attempts. Resolved shows fresh independent proof and time. Neither copying nor “Done” resolves the issue.

## State requirements

| State | Required presentation |
| --- | --- |
| Learning | Persisted discoveries and genuine running work; no generic fake progress or invented results |
| Partial | Useful confirmed facts plus explicit missing scope; retry where possible |
| Healthy | Scope, latest relevant verification, cadence and gaps; quiet successful state |
| Needs attention | Ranked meaningful Flags, understandable next action |
| Couldn't verify | What prevented a reliable answer and useful recovery/context action |
| Stale or delayed | Last known evidence distinguished from current coverage; never quietly green |
| No Outcome inferred | Useful page checks plus lightweight intent correction; no fabricated journey |
| No Flags | Successful when coverage supports it; separate from “nothing checked” |
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
