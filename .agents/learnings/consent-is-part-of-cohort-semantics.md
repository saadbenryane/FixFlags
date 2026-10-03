# Consent is part of cohort semantics

- **Date:** 2026-10-03
- **Scope:** Homepage acquisition to anonymous Site first value
- **Confidence:** High for the local contract; production coverage remains unverified
- **Discovery:** A browser event emitted only when consent already existed at mount silently lost visitors who
  granted consent while staying on the homepage. Aggregate GA event totals also could not identify which durable
  Site start belonged to that consenting session.
- **Why it matters:** Consent is not a cleanup filter applied after measurement. It determines who may enter the
  acquisition cohort. Treating an absent export as zero invents conversion evidence; exposing the private
  anonymous Site-owner token to bridge the gap would weaken the tenant boundary.
- **Correct approach:** After consent, create one random tab-scoped key containing no customer data. Put it on
  the GA landing and successful-start events and on the exact immutable server start. Join by that key, dedupe by
  session, and preserve `unavailable` or `partial` states when GA cannot return complete keys.
- **Prevention encoded:** `lib/analytics/journey-id.ts` owns consent and key shape;
  `LandingViewTracker` handles consent granted after mount; `/api/checks` validates the key;
  `analyze_started:<auditId>` retains it; the GA pull and admin cohort preserve missing/partial states; focused
  tests cover each boundary. The `ff_anon_visitor` cookie remains HTTP-only and is never used for analytics.
