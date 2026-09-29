# Outcome and Flag links require identity

Date: 2026-09-29  
Scope: Site Outcome detail and Flag detail relationship  
Confidence: high for the local customer projection; production unverified.

Evidence: `flagMatchesOutcome` returned true for a security Flag on Checkout's product URL, and for another Checkout Flag whose `improvementId` differed from the assessment's `flagId`. The focused regression failed before the repair and passed afterward. `lib/sites/__tests__/outcome-state.test.ts` now covers matching persisted identity, unrelated same-page and same-kind Flags, and a Flag detail's explicit `outcomeId`.

Discovery: A shared URL or a check-name substring shows common context, not that the Flag caused an Outcome assessment. The previous matcher used both as fallbacks, so Outcome pages could list unrelated Flags and Flag pages could link to the wrong Outcome.

Correct approach: Use the assessment's `flagId` against the Flag or Improvement ID, or the Flag detail's stored `outcomeId` against the Outcome ID. When neither relationship is stored, leave the association unknown. Showing fewer attributed Flags is more accurate than inventing proof.

Prevention: The focused regression in `lib/sites/__tests__/outcome-state.test.ts` exercises both customer projections' shared matcher. The product skill now calls out persisted identity for customer-facing links. No release or customer observation is claimed.
