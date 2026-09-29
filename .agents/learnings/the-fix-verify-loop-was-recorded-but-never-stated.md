# The Fix → Verify loop was recorded but never stated

Discovery: 2026-09-29, from read-only production queries while checking whether the Flag → Fix → Verify promise holds.

## What the data says

Read-only production query, 2026-09-29:

| Fact | Value |
| --- | --- |
| Flags FIXED with `resolvedInId` (independent proof) | **47** |
| Flags REGRESSED (prior proof nulled) | **12** |
| Customer surfaces reading `status === 'FIXED'` or `resolvedInId` | **0** |
| Watch recovery emails sent | 4 (all linked to Flags list, not a specific recovered Flag) |
| Manual Verify attempts completed | **0** |

So the product independently verified 47 recoveries and never told anyone. A REGRESSED flag erased the proof that it was once fixed.

## The documented behaviour the code did not implement

`docs/workspace-interface.md` is explicit:

> "Verify fix shows real progress and retains prior attempts. Resolved shows fresh independent proof and time. Neither copying nor 'Done' resolves the Flag."

And the Flags table in the same doc:

| Surface | Question it answers |
| --- | --- |
| Flags | What needs me? Prioritized attention; resolved history without polluting current attention |

The code did the opposite of both:

1. **No proof was ever shown.** The detail page received `flag.status` but never checked for `FIXED` or read `resolvedInId`. The proof audit and time were never rendered.
2. **No resolved history without polluting.** The Flags list showed only OPEN/REGRESSED flags. There was no "Resolved" tab.
3. **Recovery emails linked to the list.** Watch sent "Verified recovery" emails but the link went to `/sites/{id}/flags`, not to a specific Flag showing its proof.
4. **Manual Verify never completed.** The Verify button existed but 0 attempts ever finished in production.

## The fix

Minimal, self-contained changes that make the promise structurally true without inventing surfaces:

- `SiteFlagSeed` gains `resolvedInId: string | null`, propagated from the Prisma row through `toSiteFlagSeed` and `loadSiteFlagDetail`.
- The Flag detail page (`app/sites/[siteId]/flags/[flagId]/page.tsx`):
  - Loads the proof audit when `flag.resolvedInId` exists.
  - Renders a "Resolved" section with the proof time and audit ID when `status === 'FIXED'`.
  - Hides the Fix/Verify section entirely for FIXED flags (the Flag is already resolved; "Neither copying nor Done resolves the Flag").
- The Watch email (`lib/audit/project-watch.ts`):
  - The lead flag picker now includes `summary.fixed` (recovered flags) after `regressed`/`newIssues`.
  - A recovery email now links to a specific recovered Flag that shows its proof.
- The Flags list (`components/sites/SiteFlagsView.tsx`):
  - Gains a "Resolved" tab (per IA: "resolved history without polluting current attention").
  - Loads `resolvedFlags` via new `loadSiteResolvedFlags(site)` (FIXED flags with `resolvedInId`, ordered by `createdAt` desc).
  - Each row links to the detail page which shows the proof.

## What this does NOT do

- No manual "Mark resolved" / "Done" button. Resolution is independent proof only, per the doc.
- No change to the automatic resolution logic (`diffFlagsAgainstParent` → `resolveMonitoringFlagStatus`). That already required a fresh re-observation (`isPageComparableAbsence`).
- No change to REGRESSED handling. The prior proof is still nulled when a FIXED flag regresses — that is a separate question about whether history should be immutable.

## Prevention encoded

- The Flag detail page now renders the resolved state when `status === 'FIXED' && resolvedInId`. A test would catch regression if that section disappeared.
- The seed type requires `resolvedInId`, so the data is always available at the presentation boundary.
- The resolved tab reads `resolvedFlags` from the view, which is populated by a dedicated query.

## How to find this class of gap again

Read each surface against the question the IA assigns it, then read the data behind it. This was found by asking "what does the Flags list actually show and what does the detail page actually read?" not by asking what features were missing.

The same method surfaced:
- The Home/Watch gap (silence about a disabled promise)
- The delivery honesty gap (a recorded failure nobody reads)
- The Outcome confirmation gap (an agreement recorded but never verified or shown)

In every case the product had done the work (lease recovery, delivery attempt, inference, independent verification) and the only defect was that the result was never stated.