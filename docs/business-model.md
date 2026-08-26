# Business Model

*Last updated: 2026-08-25*

FixFlags sells Product Reviews with a clear capacity and workflow ladder.
The customer loop is Product Review → Fix → Verify → Watch.
Canonical pricing strategy lives in [`knowledge/strategy.md`](../knowledge/strategy.md).

## What every Product Review includes

- Product reviews across Message, Experience, and Reach.
- Evidence-backed Flags and copyable fix prompts.
- A fresh review after changes that shows what changed.
- A public report link.

## Usage plans

| Plan | Price | Product reviews/month | Products | Plan value |
|------|-------|-----------------------|----------|------------|
| Free | $0 | 3 | 1 | Review, fix, and review changes |
| Pro | $29 | 30 | Up to 5 | Product history across releases and release comparison |
| Studio | $79 | 90 | Unlimited | Scheduled reviews and a shared workspace |

The existing internal enums remain `FREE`, `BUILDER`, and `TEAM`.
Studio maps to `TEAM`.

New URL reviews, update reviews, and completed scheduled Watch reviews share the product review allowance.
Usage renews monthly and does not roll over.
At the limit, reviews pause until renewal or upgrade.
Existing purchased overflow credits remain compatible but are not promoted.

Studio includes workspace invitations and unlimited workspace seats for a limited time.
Pro and Studio remain on the waitlist while Stripe stays in test mode.
Workspace invitations must be complete before Studio checkout opens.

## What is parked

Repository scanning, editor protocols, command-line workflows, API-key setup, and deployment-triggered hooks remain implemented internally but are not part of the current customer product, marketing, documentation navigation, or pricing promise.
Deep Review is the future repository-connected analysis offer and returns only after the URL-to-report wedge converts consistently.

## Revenue model

- Monthly Pro and Studio subscriptions.
- High-volume pricing by direct conversation.
- No annual commitment at launch.
- The report itself stays equally trustworthy on every page FixFlags claims to have reviewed.
Plans add how far a public review goes: Free reviews this page and checks every public link, Pro also reviews the pages that page links to, and Studio reviews one level beyond.

## Target customer

- AI-first founders and small teams preparing to launch or ship an update.
- Freelancers, agencies, and studios repeating that workflow across products.
- Small product teams that want scheduled regression evidence.

FixFlags is not positioned as an enterprise QA suite, compliance service, or replacement for a complete test program.
