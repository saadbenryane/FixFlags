# Mutable ownership is not a cohort key

- **Date:** 2026-10-03
- **Scope:** Anonymous Site first-value and claim conversion
- **Confidence:** High
- **Evidence:** `claimAnonymousAudits` attaches a successful anonymous check to `Audit.userId`. The former admin
  query defined anonymous starts as current rows where `Audit.userId IS NULL`, so a successful claim removed its
  own start from the denominator. The existing immutable `analyze_started:<auditId>` event records whether the
  check was anonymous when it began, and `first_useful_result:<auditId>` identifies the matching result.
- **Discovery:** Current ownership answers who owns a record now. It cannot answer what state that record was in
  when a conversion cohort began.
- **Why it matters:** A mutable denominator can make conversion worse when conversion improves. It also prevents
  an operator from distinguishing start-to-result loss from signup or claim loss.
- **Correct approach:** Fix cohort membership from an immutable event, then follow the exact entity identity to
  later state. Do not add a second date cutoff to the outcome query; a result just after the cohort boundary still
  belongs to that start.
- **Prevention encoded:** `lib/analytics/site-first-value-funnel.ts` owns the cohort join,
  `lib/analytics/__tests__/site-first-value-funnel.test.ts` proves claimed starts remain in the denominator, the
  admin surface labels independent event totals as activity, and `.agents/skills/fixflags-analytics/SKILL.md`
  records the rule.
