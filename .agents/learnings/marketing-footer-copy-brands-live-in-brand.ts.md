# Canonical brand copy belongs in component tests for shared chrome

## Discovery

The shared marketing `Footer` (`components/layout/footer.tsx`) rendered the
superseded legacy tagline from `LANDING_PAGE.footer` on every marketing, docs,
error, and not-found page, while the hero, brand, SEO, and product copy all
used `BRAND.tagline` ("Your software runs. FixFlags watches."). Nothing caught
the drift because:

- `scripts/copy-drift-check.ts` does not scan `components/layout`.
- `scripts/ui-drift-guard.mjs` has no footer copy assertions.
- No existing test asserted the footer's tagline string.

## Prevention

Brand-copy assertions for shared chrome (footer, headers, nav) belong in the
component's own test, asserting the canonical string is present and the legacy
string is absent. `components/layout/__tests__/Footer.test.tsx` is the model:
mock only the heavy client children, render the real Footer, and compare
against `BRAND.*` constants (never hardcode the copy in the test).

## Rule of thumb

The canonical tagline and category live in `lib/marketing/copy/brand.ts`
(`BRAND.tagline`, `BRAND.category`, both mandated by
`docs/voice-and-copy.md`). Any public surface that still reads tagline or
made-with copy from `LANDING_PAGE.footer` (besides the newsletter fields) is
outside the current product voice and should route through `BRAND` and be
guarded by a component test.