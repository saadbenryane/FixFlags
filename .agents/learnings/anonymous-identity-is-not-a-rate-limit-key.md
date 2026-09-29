# An anonymous identity is not a rate-limit key

**Date:** 2026-09-28
**Scope:** `lib/sites/visitor-identity.ts`, `lib/audit/create-audit.ts`, `lib/sites/request-access.ts`, `app/api/checks/route.ts`
**Confidence:** HIGH
**Evidence:** The raw IP was doing double duty as both a rate-limit identifier and the tenancy key for anonymous Site boards. Two consequences were reproduced and then proven fixed in production after deploying `19843d3b`: with no proxy headers every visitor collapsed onto the literal `'unknown'` and shared one board, and a bare-URL dedupe match handed a stranger's existing audit to a first-time visitor, who then had no claim cookie for it and signed up to an empty account.

## Discovery

One value, `requestClientId` (the client IP), was used for three unrelated jobs: bounding abuse, owning the anonymous Site board, and deciding whether an in-flight scan could be reused. Each job needs a different key.

The IP is the correct key for exactly one of them. As a tenancy key it is wrong three ways: it is personal data retained for the life of the board, everyone behind one NAT or corporate proxy shares it, and when the trusted proxy header is absent every visitor collapses onto a single literal and silently shares one board. When a stranger can inherit a stranger's board, the first scan of a stranger's site is what proves the bug: visitor A scans a URL, visitor B requests the same URL and receives A's report plus a Site board that is not B's.

Reuse compounds it. Deduplicating by URL alone is unowned: it cannot tell "my last scan of this site" from "someone else's scan of this site", so it answers the wrong question by handing over the wrong record.

## Why it matters

This is the first thing a stranger does, and it decides whether the product has an account at all. The failure is silent and looks like success: a report loads, the Site exists, and the claim silently fails, so the customer pays attention, signs up, and arrives at an empty account with no indication of why. Every subsequent decision is made from that empty state.

The shared-`'unknown'` case is worse than the reuse case, because it never produces a visible error at all. It just means two people using the same network are the same customer.

## Correct approach

1. Separate identity from abuse control explicitly, and give each one module that owns it. `requestClientId` keeps the IP for rate limiting; `lib/sites/visitor-identity.ts` owns identity.
2. An anonymous identity must be an opaque random token in an httpOnly cookie, not anything derived from the request. Private, stable, and free of personal data are all three requirements, and only a random token satisfies all three.
3. Degrade safely outside a request. In a worker or CLI there is no cookie jar, so return an unpersisted random key. Never fall back to a shared literal, or unrelated callers share a board.
4. Provide a read-only variant for request paths that must not mutate cookies. Resolving a board should never mint an identity.
5. Scope reuse to what the visitor already owns, not to the URL. The visitor's own `provisionalSite` row is already keyed by (identity, canonical host) and already records the audit that produced it, so "my last scan of this site" needs no new state and no schema change.
6. Put the claim cookie before the reuse return. A reused scan is still the visitor's to claim, and a returning visitor must not sign up to an account missing their Site.

## Rejected approaches

- **Keeping the IP and hashing it.** Hiding personal data is not the same as not retaining it, and a hash of an IP is still trivially reversible over the IPv4 space. It also does not fix the shared-`'unknown'` collapse.
- **Reuse keyed on IP plus a time window.** Still unowned, since the same NAT and the missing-proxy case both fail the same way.
- **Fixing only the reuse bug.** The stranger-report defect and the shared-board defect share one cause. Fixing the symptom without splitting the key would have left the identity model wrong.
- **Reusing an existing anonymous session cookie.** The existing cookies are claim and scan-access state, not a stable identity, and coupling them would re-conflate separate concerns.

## Prevention encoded

- `lib/audit/__tests__/anon-visitor-identity.test.ts` covers both defects.
- The visitor key has a versioned, self-describing format (`anon-v1:...`) so a future format change is detected rather than silently misread, and a malformed cookie mints a new identity instead of being trusted.
- A host-only leftover cookie is cleared before the shared-domain cookie is set, so www and apex cannot end up with two different identities for one visitor.
- Production proof after deploy: visitor A scanning a URL twice reuses its own report; a fresh visitor B requesting the same URL gets a different report and a different Site, with `reused:false`, and each signed claim cookie decodes to only its own audit id.

## Open

Free-plan signup was verified through the arrival walk and the claim cookie, not by completing a real signup and confirming the Site appears in the account. That end-to-end confirmation still needs a real account.
