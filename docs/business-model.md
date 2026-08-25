# Business Model

*Last updated: 2026-08-25*

FixFlags sells monthly review capacity for one complete URL-first web product.
The customer loop is Product Review → Fix → Verify → Watch.
Canonical pricing strategy lives in [`knowledge/strategy.md`](../knowledge/strategy.md).

## What every plan includes

- Product reviews across Message, Experience, and Reach.
- Evidence-backed Flags and copyable fix prompts.
- Update reviews with before-and-after comparison.
- Saved history, protected sharing, Canvas, Product Signals, and scheduled Watch.
- Deep reviews with Funnel, path, and playback evidence.

## Usage plans

| Plan | Price | Product reviews/month | Deep reviews/month |
|------|-------|-----------------------|--------------------|
| Free | $0 | 3 | 1 |
| Pro | $29 | 15 | 3 |
| Studio | $79 | 50 | 10 |

The existing internal enums remain `FREE`, `BUILDER`, and `TEAM`.
Studio maps to `TEAM`.

New URL reviews, update reviews, and completed scheduled Watch reviews share the product review allowance.
Deep reviews use a separate allowance.
Usage renews monthly and does not roll over.
At the limit, reviews pause until renewal or upgrade.
Existing purchased overflow credits remain compatible but are not promoted.

## What is parked

Repository scanning, editor protocols, command-line workflows, API-key setup, and deployment-triggered hooks remain implemented internally but are not part of the current customer product, marketing, documentation navigation, or pricing promise.
They return only after the URL-to-report wedge converts consistently.

## Revenue model

- Monthly Pro and Studio subscriptions.
- High-volume pricing by direct conversation.
- No annual commitment at launch.
- No capability-based upsells inside the core web loop.

## Target customer

- AI-first founders and small teams preparing to launch or ship an update.
- Freelancers, agencies, and studios repeating that workflow across products.
- Small product teams that want scheduled regression evidence.

FixFlags is not positioned as an enterprise QA suite, compliance service, or replacement for a complete test program.
