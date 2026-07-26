# Rendered evidence for live accuracy

Measured on 2026-07-26 against `https://saadbenryane.com/`:

- The raw HTML-only probe reported `no-cta-detected` and `skip-link-missing`.
- A 375 × 812 Playwright render found “Book a call” at 394px and a skip link as the first focusable control.
- The maintained live probe now parses the hydrated DOM and supplies mobile capture metrics to the same deterministic check registry used by the audit path.

Prevention: live absence, visibility, geometry, and bypass claims must use rendered evidence. Frozen HTML remains valid for hermetic metadata and static-markup checks, but it cannot disprove client-rendered UI.
