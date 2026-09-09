# FixFlags card-board experience

**TARGET design, owner brief of 2026-09-08.** This refines the [vision](../knowledge/vision.md), [interface contract](workspace-interface.md) and [PRD](product-prd.md). It supersedes conflicting dashboard hierarchy and shadow-first card guidance. It is design evidence, not a production release.

**Your website, looked after.** One website. One board. Everything that matters.

## Information architecture

The primary product is one flat card grid. Every card answers an understandable question about the same Site. Checks create evidence; cards create understanding; Flags create attention. Shopify, Analytics, Meta and Search Console enrich this Site rather than create separate products. Pages are nodes in journeys toward Purchase, Signup, Contact, Book or Donate.

Desktop navigation: Dashboard, Flags, Site. Mobile: Home, Flags, Site. Account, settings, Site switching and retained billing are supporting controls. Capabilities do not become permanent navigation destinations.

## Connected screens

| Experience | Prototype entry | Responsibility |
| --- | --- | --- |
| First visit | Scenario 01 | Immediate starter board with resolved checks and independent checking activity; discoveries, running and queued checks inside Site activity |
| Connected | Scenario 02 | Same cards enriched by source metrics and freshness, with one restrained Search concern |
| Mobile | Phone control or narrow viewport | Same state and cards in a priority stream; 393 × 852 viewport, safe-area navigation, full-height detail sheets |
| Add Card | Dashed card | Recommendations for this Site, search and library-only categories |
| Card depth | Search or Performance | Overview, pages, underlying checks, history, source and coverage limits |
| Important Flag | Scenario 03 → View Flag | One purchase failure with Conversion, Tracking, Paid traffic, Revenue and Changes context; evidence and verification |

Scenario 04 demonstrates quiet health. The runnable prototype lives in `prototypes/fixflags-board`. Data, sources, account actions and verification are illustrative; no external monitoring, payment, notification or integration calls occur.

## Card and state contract

A card contains a name, current answer or metric, at most one useful visual, one to three facts, relevant Flag/action and source/freshness. The permanent compact Site card includes identity, thumbnail, human status, coverage counts, deduplicated Flag count and activity/check controls. The starter board is Site, Security, Search, Performance, Conversion, Tracking and Add card.

Health cards answer whether something works. Context cards explain what is happening without fabricated health labels. Missing context becomes unavailable while supported public checks remain useful. Connecting a source transforms the recommendation into its useful card.

| Dimension | Meaning | Presentation |
| --- | --- | --- |
| Healthy | Sufficient current evidence for the stated scope | Small green signal with an accessible status label. Freshness appears in card depth, not repeated across the board. |
| Needs attention | Meaningful review without confirmed severe failure | Brand-orange signal with the area’s Flag count. Open the card to read the relevant Flags. |
| Problem | Confirmed important failure | Brand-orange signal, restrained orange edge, Flag chips, and a clear card-depth action |
| Unknown | Missing, unavailable, insufficient or expired evidence | Gray signal and explanation/recovery |
| Checking | Activity independent of health | Brand orange ring and actual work description |

Card header anatomy: name on the left; status signal and compact Flag count on the right. The signal and card open the same detail. One overall count lives in the board header; the Site thumbnail does not repeat it. Cards keep one short answer, at most two lines of context, and a compact thumbnail. Full screenshots, timestamps, sources, checked pages and Flag links live in the detail panel. The homepage and signed-in overview share the same card primitive; the live Site uses the same board surface. Dialogs trap focus, support Escape, and restore focus to the opener.

The Site detail reads actual AuditPage results for the resolved latest audit, behind the existing Site access check. Queued, partial and failed pages stay distinct from completed pages. Older unresolved Improvements retain their originating Flag evidence and check identity, so counts, category cards and detail links agree. Never replace missing evidence with a healthy claim.

The Add card is last on the grid. Its library currently offers public-check cards (Uptime, Accessibility). Connections do not appear as a logo marketplace.

In production, checking retains the last known health result and its time. Stale evidence cannot imply current health. No giant score, fake progress percentage, blue status palette or green card backgrounds.

## Grid and interaction system

Desktop: 12 columns, 16px gaps, standard cards spanning 3 columns, wide cards spanning 6. Compact shares standard width with reduced content and height. Approximately 20px padding, 17px desktop/16px mobile radius, thin subtle borders and restrained shadows. The owner's homepage-alignment refinement uses white cards, clean stone-gray canvas, ink type, Inter body and Inter Tight headings. Preserve the latest canonical bright orange `#FF5A00` with ink button labels; amber has a distinct semantic role. Earlier brown-orange and olive-gray prototype styling is superseded. Map prototype values into canonical tokens during implementation.

Add, remove optional cards, pin, resize within footprints and reorder. Offer move-earlier/later controls alongside dragging. Removal changes presentation, not monitoring responsibility: preserve Flags in Site and Flags. Site stays first and Add card last. Production saves layout per user and Site; the prototype uses local storage per example scenario.

Mobile orders Site, confirmed problems, review concerns, primary Conversion outcome, then remaining cards. Pins/manual order apply within priority groups. Desktop preserves spatial order during an incident. Use readable facts, touch targets and the same detail model, without squeezing desktop columns into a phone.

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
