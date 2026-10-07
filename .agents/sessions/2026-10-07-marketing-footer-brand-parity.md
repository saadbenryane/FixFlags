# Marketing footer brand parity

**Task:** `marketing-footer-brand-parity-2026-10-07`
**Status:** locally verified; not pushed or deployed

## Gap found

The shared marketing `Footer` rendered the superseded legacy tagline
("FixFlags finds the website problems that matter, shows why they matter, and
keeps watching.") and made-with line ("Built for businesses that depend on
their website.") on every marketing, docs, error, and not-found page. The
hero, brand, SEO, and product copy all use the canonical
`Your software runs. FixFlags watches.` (`BRAND.tagline`, mandated by
[`docs/voice-and-copy.md`](../docs/voice-and-copy.md)), so the footer contradicted
the rest of the brand.

## Repair

- `components/layout/footer.tsx` now renders `BRAND.tagline` in the footer
  tagline slot and `BRAND.category` ("Independent monitoring for the outcomes
  that matter.") in place of the legacy made-with string.
- `LANDING_PAGE` is no longer imported by the Footer; the newsletter section
  (`FooterNewsletter`, which reads `LANDING_PAGE.footer.newsletter`) is
  untouched.
- Added `components/layout/__tests__/Footer.test.tsx`, which renders the real
  Footer with only heavy children mocked and asserts the canonical tagline and
  category are present and both legacy strings are absent.

The legacy strings remain in `lib/marketing/copy/homepage.ts` for legacy
surfaces; only the shared Footer consumer was moved to canonical brand copy.

## Evidence

- Focused Footer tests 3/3; adjacent layout and landing suites 15/15.
- `npm run typecheck`, scoped ESLint on both changed files, `npm run
  copy-drift-check`, and `npm run ui:drift-guard` all passed.
- Full `npm run verify` (build, worker, runtime checks) exited 0.
- Real Playwright walk against the local dev server on home,
  how-it-works, samples, pricing, faq, a not-found page, install, and waitlist:
  every page showed the new tagline and category, no legacy strings, and no
  console errors (the not-found page's single 404 resource message is
  expected).

Not pushed (team pattern: releases wait for authority) and not deployed.