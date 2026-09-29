# The Outcome loop has never been entered, and a `kind` is why

Discovery: 2026-09-29, from read-only production queries while looking for the next honest gap after the Watch delivery work.

## What the data says

Read-only production query, 2026-09-29:

| Fact | Value |
| --- | --- |
| Sites (projects) | 11 |
| Site Outcomes | 9, all on one project, **all `GENERIC`**, 4 created 20d ago and 5 at 17d ago |
| Confirmed Outcomes | **0** |
| Audits | 160 total, 130 COMPLETED, 30 FAILED and every failure predates Sep 20 |
| Flags | 3685 |
| Watch enabled | 1 Site |
| Sessions | 14 rows; the most active user last logged in Sep 12 |

So the product ran 130 completed checks and produced 3685 Flags, and **not one customer ever entered the loop the product is built around**. Not one Outcome was ever confirmed.

## The documented behaviour the code does not implement

`docs/workspace-interface.md` is explicit on both halves:

> "Home first shows concrete Outcomes and their Clear/Flag/Couldn't verify/Stale state, then attention, then Pages, Security, Search, Performance, Conversion, Tracking and other category depth."

> "Use concrete Outcome names such as Checkout and Signup and the smallest useful confirmation. ... **Looks right / Edit corrects inferred intent**; it is not a funnel-design task. Preserve edited understanding across future analysis."

The code does the opposite of both. `components/sites/SiteBoard.tsx` filters `kind !== 'GENERIC'` in three places and `lib/mcp/tools/sites.ts:80` does the same, so every inferred Outcome is invisible. The view already carries them, `loadSiteHome` passes `listSiteOutcomes` straight through, so this is a presentation-boundary discard, not a missing query. And there is no "Looks right" or Edit affordance anywhere: the Outcome detail page has only `VerifyOutcomeButton`, which is disabled whenever there is no required binding.

> Correction, 2026-09-29, after `signup-outcome-never-ran`: the "no affordance anywhere" claim above was **half wrong and the wrong half was load-bearing**. A `SiteOutcomeEdit` component did exist, and it was dead, not absent: nothing imported it, and its "Looks right" button posted a confirmation with no `kind`, which `94cf309d` had just made always fail. So the loop was not blocked by a missing control, it was blocked by a control that could not work. Treat "no affordance exists" as a claim to verify by grepping for references, not by reading one page.

With 9 inferred Outcomes and 0 confirmed, Home shows zero Outcomes and the documented Home hierarchy cannot start. The only confirmation path that exists is "Confirm this page", which creates a single AVAILABILITY Outcome for the site root.

## Why it cannot simply be built

The blocker is the model, not the UI. `kind` is not a label. `bindingForConfirmedKind` in `lib/sites/outcomes.ts` maps it to the execution mechanism that will verify the Outcome:

- `CHECKOUT` → `checkout-browser-v1`, `BROWSER_JOURNEY`, `safety: 'stop-at-checkout'`
- `SIGNUP` → `signup-form-v1`, `SAFE_FORM`, `safety: 'protected'`
- `AVAILABILITY` → `page-availability-v1`, `HTTP_AVAILABILITY`

Inference, meanwhile, produces arbitrary human-language behaviors. The nine inferred slugs on the live project include `share-and-social-previews-represent-the-product-accurately`, `primary-navigation-and-the-main-cta-remain-clickable`, and `a-new-visitor-can-start-signup-or-trial-without-dead-ends`. **None of them fit any of the three kinds.** Confirming a social-preview Outcome as SIGNUP would attach a signup binding to it and then report a signup result as its verification, which is a worse lie than showing nothing.

So the documented "Looks right / Edit" loop is not implementable today for most inferred Outcomes. Surfacing them without a way to verify them would fill Home with "Couldn't verify" rows, which is the exact false-assurance failure `knowledge/evidence-rules.md` exists to prevent. This is why the inferred Outcomes are hidden, and it is a defensible engineering decision that nobody wrote down.

## The part that was a genuine defect

"Confirmed with no kind" was accepted by the API. It wrote `confirmedAt` and `inferenceSource: 'user'`, left `kind` as `GENERIC`, and added no binding, so the Outcome was simultaneously recorded as agreed, hidden by every surface, and impossible to verify. Fixed in `94cf309d`: the command refuses it with `OUTCOME_KIND_REQUIRED` and a message naming the three things FixFlags can actually watch, and the route answers 400 instead of a blanket 404 that sent the customer looking for a row that exists.

`confirmed: false` with a name still works, because "Looks right / Edit" needs a way to *withdraw* an agreement. `watchPage: true` goes through `CONFIRM_PAGE_AVAILABILITY` and is untouched. MCP and the Site Agent never call `CONFIRM_OUTCOME`, so no shipped path changed behavior.

## This needs an owner decision, not an implementation

Two coherent directions, both legitimate, and the repo does not currently say which is intended:

1. **Widen what FixFlags can verify.** Add a kind and an execution mechanism that covers an arbitrary inferred behavior, so "Looks right" becomes real, then surface the inferred Outcomes as proposals on Home. This is the vision-faithful path and it is a real chunk of work: a new mechanism, honest coverage and exclusions, and a proposal state that is visibly not yet a commitment.
2. **Keep inferred understanding internal.** Inference seeds the model's understanding and nothing else, inferred Outcomes stay hidden, and the product stops implying that a scan produces watchable Outcomes. Cheaper and honest, at the cost of the documented "Looks right / Edit" line and of the inference work being invisible.

Picking between them is a product call about what FixFlags is, and the evidence above is what it should be made on. What should not happen is a third option: showing inferred Outcomes on Home with no verification path, which would make the core loop look entered when it is not.

## How to find this class of gap again

Read each surface against the question the IA assigns it, then read the data behind it. This was found by asking what the nine inferred Outcomes were doing, not by asking what was missing from the feature list. The same method surfaced the Home/Watch gap in `claimed-side-effect-is-a-lease-not-a-state.md`.

## Prevention encoded

- `lib/sites/__tests__/confirm-outcome.test.ts` pins the refusal, that the unverifiable write never happens, that the message is not "not found", and that unconfirming still works.
- `app/api/sites/[siteId]/outcomes/__tests__/route.test.ts` pins 400 plus the code, 404 still for a missing Outcome, and that access is refused before any command runs.
- Until the direction above is decided, the `kind !== 'GENERIC'` filters are the thing standing between a customer and nine unverifiable promises. They should not be removed casually.
