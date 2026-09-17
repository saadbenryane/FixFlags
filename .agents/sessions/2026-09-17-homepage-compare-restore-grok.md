# Homepage compare restore · 2026-09-17

Saad approved restoring the locked compare table on the Care homepage so cold traffic sees “What your site should answer.” without `/pricing`.

## Change

`CareHomepage` embeds `<MarketingCompareSection embedded />` in existing Care section spacing after the Flag / Fix / Verify evidence section and before intelligence, actions, monitoring, and the final CTA. Pricing still embeds the same component. `SITE_COMPARE` copy is unchanged.

## Why embedded

Care sections are a 1120px column. The default compare wrapper uses the wider marketing container. Embedded keeps one table component and matches homepage gutters.

## Verification

- `npx vitest run` homepage + pricing tests: 19 passed.
- ESLint on touched files: clean.
- Browser: localhost:3000 desktop and 375px. Compare sits after Flag / Fix / Verify evidence, not above the hero URL. Final CTA remains below. `/pricing` still shows the same table.

No deployment. No merge unless asked.
