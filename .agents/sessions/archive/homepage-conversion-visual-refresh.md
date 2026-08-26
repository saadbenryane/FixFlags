# Homepage conversion and visual refresh

Date: 2026-08-26

## Outcome

The homepage now leads with a concrete review outcome and no longer shows the low-value hero assurances “Evidence from your live site” or “3 reviews included free.”
The pricing assurance “No credit card for Free” is now the concrete entitlement “Free includes 3 Product Reviews.”
The sample identity is DemoSite across the fixture, homepage workspace, sample metadata, SEO copy, evidence context, and Open Graph artwork.
The sample-section body no longer names the old Launchpad identity.

## Visual system

The hero uses a restrained animated evidence path with one moving Flag-orange signal and a reduced-motion fallback.
The How it works section uses a generated transparent three-stage live page → Flag → update-review composition.
The Message, Experience, and Reach section uses a generated transparent three-lens review composition.
The final URL CTA reuses the existing live-review visual, which explicitly shows Message, Experience, and Reach instead of relying on an abstract gateway metaphor.
The homepage compositions use the FixFlags white, stone, ink, and Flag-orange material language and are registered in `lib/marketing/artwork-manifest.json`.

## Proof

`npm run agent -- verify` passed all nine affected-file commands, including typecheck, lint, marketing tests, UI drift, image guards, and SEO guard.
The focused homepage, DemoSite, display metadata, and workspace tests passed with 54 tests, followed by a final 49-test copy and identity pass after the Open Graph rename.
The generated-art guard passed for all three homepage assets.
Playwright browser checks covered 375px, 768px, and 1440px widths.
The homepage had no horizontal overflow at those widths.
The final CTA placeholder remained fully visible at 255px on the 375px viewport and 395px on the desktop viewport.
Desktop and mobile screenshots are stored under `output/playwright/homepage-conversion-refresh/`.

## Generated assets

The built-in image generator produced the homepage workflow, review-rubric, and DemoSite Open Graph assets.
The final homepage WebP assets are `public/marketing/visuals/how-it-works-workflow-v4.webp`, `public/marketing/visuals/review-rubrics-v4.webp`, and the existing `public/marketing/visuals/how-it-works-review-v3.webp`.
The DemoSite Open Graph replacement is `public/demo/og-v1.png`.

## Verification note

One source-less JavaScript parse error appeared once in a development browser immediately after restarting the Next.js server.
A fresh browser session after the server stabilized reported zero console errors, and the server compiled the homepage successfully with repeated HTTP 200 responses.
