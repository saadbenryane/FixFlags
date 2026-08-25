# Game On homepage Wave 1

Date: 2026-08-25

Owner: `homepage-wave1`

## Outcome

The homepage now presents one human narrative from live URL to issue, fix, and update review.
The hero uses the approved subhead, exactly two product-true assurances, a centered sample action, and no privacy or offer line.
The sample identifies the repository-owned Launchpad demo and renders the shared workspace with one CTA to `/samples`.
The duplicate rubric counts, dark metrics section, preview CTA, final-CTA assurances, and footer metrics were removed.
The three review rubrics now use the approved customer questions and concise checklists instead of fabricated Example Flags.
How it works is a simple three-step icon sequence headed “Find the issues. Fix them. See what improved.”
The builder workflow leads with copy and paste, then identifies MCP and CLI as Pro workflow options and uses “update review.”

## Proof

- `npx vitest run components/audit/__tests__/AuditInput.test.tsx components/marketing/landing/__tests__/HomepageRefinement.test.tsx lib/__tests__/homepage-assets.test.ts lib/__tests__/homepage-message.test.ts`: 49 tests passed.
- Focused ESLint on the changed homepage files: passed.
- `npx tsc --noEmit`: passed against the integrated Wave 1 tree.
- `npm run brand:hex-guard`: passed.
- `npm run image:local-patterns-guard`: passed.
- `npm run image:artwork-guard`: passed.
- `npm run seo:guard`: passed.
- `npm run ui:drift-guard`: passed.
- Direct Playwright proof at 375, 768, and 1280 pixels: approved hero visible, sample CTA center delta 0 pixels, one `/samples` CTA, removed `199+` metric absent, How it works heading visible, and horizontal overflow 0 pixels.
- A repeated 375-pixel browser load after compilation had no console errors or page errors.

## Integration note

`npm run agent -- eval ui` rebuilt successfully but its four `/samples` checks still look for `aria-label="Product fixflags.com/demo"`.
The report Wave 1 work intentionally removes duplicate Product identity from the Report header, so Wave 2 verification must update that expectation to the canonical identity surface and rerun the matrix.
The homepage-focused browser proof itself is green.
