# Pricing packaging and demo request

**Date:** 2026-09-09
**Task:** `pricing-packaging-demo`
**Branch:** `main`

Public packaging now sells 24/7 monitoring: one free website every 24 hours, then `$49` per website per month up to every hour. Studio is volume, billed per website, never unlimited Sites. Paid CTAs go to `/request-demo` (not `/demo`, which is the DemoSite fixture). Stripe stays closed.

Demo requests persist in `demo_requests`, email `DEMO_NOTIFY_EMAIL` (fallback `ADMIN_NOTIFICATION_EMAIL`), and confirm the requester from `hello@fixflags.com`. Phase 4 internals (pulse vs full-walk, per-site checkout quantity) are recorded in `knowledge/strategy.md` and `ROADMAP.md`. Live `auditLimit` 3/30/90 and Stripe price IDs are unchanged.

Focused tests: pricing-parity, plans, pick-plan, billing-enforcement, PlanPickerDialog, PlanPrice, demo-request route, funnel-call-sites, UsageMeter, shopify-customer-ready, seo-discovery. `billing:plans-guard`, `help:catalog-guard`, `copy-drift-check`, and `db:validate` passed. `metadata-route-guard` still fails on `/protect` (Shopify owner). `seo:guard` still flags parked `roast`. Browser QA of `/pricing` and `/request-demo` was not run here.
