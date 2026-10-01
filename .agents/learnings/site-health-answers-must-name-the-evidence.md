# Site health answers must name the evidence

Date: 2026-10-01

## Finding

The new Site board was deciding category health from direct coverage evidence, but presenting that answer through legacy report rubrics or generic copy. A completed Conversion journey could read `Score 92`, while other covered areas read `Looking good` and `Latest check passed for this area`. Those labels hid what FixFlags had actually exercised and made a broad rubric look like proof of a specific category.

## Durable rule

For a healthy Site category, pair `0 Flags` with the concrete evidence that ran:

- Conversion names the completed browser journey.
- Search names inspected page metadata.
- Performance names desktop, mobile or both measured viewports.
- Uptime names the reached page and inspectable response evidence.
- Accessibility names the completed automated tests.

Do not select report rubrics or carry report scores into the Site query and board view. Scores remain a legacy report compatibility concern. Unknown, stale, checking and Flag states keep their existing evidence and freshness rules.

## Prevention

- Centralize these answers in `SITE_BOARD_COPY.healthyEvidence`.
- Keep the Site coverage and board-card contracts score-free.
- Test each positive evidence path and the performance viewport variants.
- Exercise a stored scan at a mobile viewport and assert that score/generic filler is absent from the rendered page.
