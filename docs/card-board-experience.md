---
status: canonical
authority: interface
reviewed_at: 2026-10-10
supersedes: []
---

# FixFlags card-board experience

**CUSTOMER BOARD CONTRACT, reconciled 2026-10-07 with owner testing.** The selected Site Overview uses the retained flat card grid. Visitor-action cards use the existing Outcome domain; website-health cards retain their distinct evidence scope. This is design acceptance, not a production release claim.

**Your software runs. FixFlags watches.** One Site, clear Outcomes, and broader Product health underneath.

## Information architecture

Home shows all websites. A selected Site shows identity and a compact, always-visible progress/result panel followed by one flat card grid. Confirmed visitor-action cards and website-health cards share that grid without conflating their health. Do not put an empty Outcomes heading or a full Flag list ahead of the grid. Outcomes remain the engineering domain, not a concept customers must learn before using the board. Shopify and other connections enrich the same Site.

Websites remains `/dashboard` and uses full-width Site rows below one Analyze control. Selected Site navigation is Overview, Flags, Settings on desktop and mobile, with All websites as the return action. Monitoring belongs to Site identity and Settings, never the navigation rail. Detailed Flags belong on Flags or category depth. Ask FixFlags appears only where it has grounded Site or Flag context.

One current answer and its recovery action must be visible without opening disclosures. Pipeline milestones belong in the Activity dialog, never a permanent checklist on the Overview, nested dropdowns, or a repeated per-page event dump. Unconfirmed inferred actions are offered through setup, not shown as configured cards.

Owner testing, October 7, reconciled with the clear-first Site: make the Overview scannable rather than explanatory. Monitoring is a compact header signal. One run banner communicates Analyzing, Analysis incomplete, Updates paused, or disconnected updates, with one recovery action. Completed pipeline narration stays hidden. Each card shows one category label, one answer that reflows, one status, and the Flag count at the bottom left when that count is the result. Card surfaces stay neutral. Orange, green, gray, and progress treatment sit on the status signal. Impact, diagnosis, timestamps, and evidence remain in category depth. Unknown or stale cards retain their limitation. A Flag count is not a substitute for stale, failed, or incomplete evidence. Presentation-only labels may shorten known findings; they must not rewrite the stored finding or invent a healthy answer.

Card detail is a structured priority queue: category icon and count, severity-based groups, icon-led finding cards with the affected page, and evidence/scope below. Start with the highest nonempty priority; show every group's count and paginate large groups explicitly rather than dumping dozens of identical rows. Suggestions are separate and cannot imply confirmed Flags. All original Flag identities, diagnoses, evidence, and Fix → Verify links remain intact. Unconfirmed inferred actions cannot be presented as verified scope.

## Connected screens

| Experience     | Prototype entry                  | Responsibility                                                                                                                              |
| -------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| First visit    | Scenario 01                      | Immediate starter board with resolved checks and independent checking activity; discoveries, running and queued checks inside Site activity |
| Connected      | Scenario 02                      | Same cards enriched by source metrics and freshness, with one restrained Search concern                                                     |
| Mobile         | Phone control or narrow viewport | Same state and cards in a priority stream; 393 × 852 viewport, safe-area navigation, full-height detail sheets                              |
| Add            | Header action                    | Executable Outcomes, additional coverage, and configured connections                                                                         |
| Card depth     | Search or Performance            | Overview, pages, underlying checks, history, source and coverage limits                                                                     |
| Important Flag | Scenario 03 → View Flag          | One purchase failure with Conversion, Tracking, Paid traffic, Revenue and Changes context; evidence and verification                        |

Scenario 04 demonstrates quiet health. The runnable prototype lives in `prototypes/fixflags-board`. Data, sources, account actions and verification are illustrative; no external monitoring, payment, notification or integration calls occur.

## Card and state contract

A card contains a name, current answer or metric, at most one useful visual, one to three facts, relevant Flag/action and source/freshness. The permanent compact Pages card includes identity, thumbnail, page count, Flag count and activity. The starter board is Pages, Security, Search, Performance, Conversion, Tracking and Add card.

Health cards answer whether something works. Context cards explain what is happening without fabricated health labels. Missing context becomes unavailable while supported public checks remain useful. Connecting a source transforms the recommendation into its useful card.

| Dimension       | Meaning                                                      | Presentation                                                                                                                         |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Healthy         | Sufficient current evidence for this category’s stated scope | Small green signal and useful metric. This is category health and does not by itself make an Outcome Clear.                          |
| Needs attention | Meaningful Flags without a confirmed severe failure          | Brand-orange signal with the area’s Flag count. Open the card to read the relevant Flags. Do not render the words “Needs attention.” |
| Problem         | Confirmed important failure                                  | Brand-orange status signal and a clear card-depth action. The card surface stays neutral.                                            |
| Unknown         | Missing, unavailable, insufficient or expired evidence       | Gray signal and explanation/recovery                                                                                                 |
| Checking        | Activity independent of health                               | Brand orange ring and actual work description                                                                                        |

Card anatomy: one category label, one answer, one status signal, and the Flag count at the bottom left when Flags are the result. The card is one navigation target. One overall result lives in the board header with freshness and coverage. Full screenshots, timestamps, sources, checked pages, and Flag links live in responsive depth: a dialog on desktop and a full-height sheet on mobile. Depth traps focus, supports Escape, and restores focus to the opener.

The Site detail reads actual AuditPage results for the resolved latest audit, behind the existing Site access check. Queued, partial and failed pages stay distinct from completed pages. Older unresolved Improvements retain their originating Flag evidence and check identity, so counts, category cards and detail links agree. Never replace missing evidence with a healthy claim.

Add is one header action. It offers executable Outcomes, additional coverage, and configured connections. It is not a logo marketplace and not a trailing library tile.

In production, checking retains the last known health result and its time. Stale evidence cannot imply current health. No giant score, fake progress percentage, blue status palette or green card backgrounds.

## Grid and interaction system

Desktop: 12 columns, 16px gaps, standard cards spanning 3 columns, wide cards spanning 6. Compact shares standard width with reduced content and height. Approximately 20px padding, 17px desktop/16px mobile radius, thin subtle borders and restrained shadows. The owner's homepage-alignment refinement uses white cards, clean stone-gray canvas, ink type, Inter body and Inter Tight headings. Preserve the latest canonical bright orange `#FF5A00` with ink button labels; amber has a distinct semantic role. Earlier brown-orange and olive-gray prototype styling is superseded. Map prototype values into canonical tokens during implementation.

No dragging, resizing, arbitrary cards, or new monitoring domain. Prototype layout customization is not a shipped capability. Pages stays a coverage card. Cards rank by Fix-first Flags, other Flags, incomplete or stale evidence, then current zero-Flag categories.

Mobile orders Pages, confirmed problems, review concerns, primary Conversion journey, then remaining cards. Pins/manual order apply within priority groups. Desktop preserves spatial order during an incident. Use readable facts, touch targets and the same detail model, without squeezing desktop columns into a phone.

## Evidence and attention

Cards reference stable shared Flag identities. Count underlying issues rather than every card projection. Hidden cards cannot hide important failures from aggregate attention. Deployment and revenue changes are temporal context unless causality is established. Campaign exposure describes a dependency, not proof every visitor failed or spend was lost.

Fix this exports reproduction, observed/expected behavior, scope and verification criteria. Copying does not resolve. Verify fix can remain failing, become inconclusive, or show independent recovery. Preserve original evidence and attempts; update related cards together after a fresh relevant pass. Historical source context remains timestamped and subject to access/retention rules.

## Implementation handoff

1. Phase 1: Site, page/journey relations, explicit coverage, stable Flag identities and card projections. Separate health, activity and source availability.
2. Phase 2: public-evidence starter board, real Site activity, responsive navigation, library/customization and one complete card detail. Replace all prototype timers with genuine check progress.
3. Phase 3: real Flag evidence and fresh verification, including persistent failures, inconclusive results and recurrence.
4. Phase 4: durable account claim, actual watching, scheduling, freshness and meaningful alerts, retaining billing foundations.
5. Phase 5: independently verified adapters enrich existing cards. Missing integrations never block the URL-based core.

Release requires persistence, authorization, revocation, billing regression proof, honest coverage and independent evidence. The prototype completes the design deliverable, not these production phases.
