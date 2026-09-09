# FAQ accordion overflow, branded links, schema.org

Date: 2026-09-09
Task: `faq-accordion-schema`
Owner: grok
Branch: main

## Outcome

Open FAQ answers stay inside a card-radius item. Learn-more is Flag Orange and points at a live route. `/faq` and `/pricing` emit FAQPage JSON-LD that matches the visible questions.

## Cause

`rounded-full` on an expanding accordion painted a stadium. The answer rectangle sat outside that fill. Learn-more used `text-link` (blue). One pricing CTA labeled Request a demo pointed at a help article instead of `/request-demo`. Pricing had no FAQPage schema.

## Proof

- Vitest: FaqSection, TextLink, structured-data FAQPage, link-guard, pricing page JSON-LD, related copy tests.
- Browser at 375 and 1280 on `/faq` and `/pricing`: no overflow, link color `rgb(255, 90, 0)`, href `/help/billing-and-plans/free-vs-pro`.
- Local help article HTML 500s from a stale Next vendor-chunk cache. The route exists; production `/help/billing-and-plans/free-vs-pro` returns 200.

## Not deployed
