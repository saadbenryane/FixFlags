# Homepage compare restore · 2026-09-17

Saad approved restoring the locked compare table on the Care homepage so cold traffic sees “What your site should answer.” without `/pricing`.

## Change

`CareHomepage` embeds `<MarketingCompareSection embedded />` in existing Care section spacing after the Flag / Fix / Verify evidence section and before intelligence, actions, monitoring, and the final CTA. Pricing still embeds the same component. `SITE_COMPARE` copy is unchanged.

## Why embedded

Care sections are a 1120px column. The default compare wrapper uses the wider marketing container. Embedded keeps one table component and matches homepage gutters.

## Verification

Focused homepage and pricing tests cover source inclusion, heading order, and locked columns. Browser review follows on the PR.

No deployment. No merge unless asked.
