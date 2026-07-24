# Technology observation boundaries

**Date:** 2026-07-23  
**Scope:** audit capture, technology profiles, re-checks, and public `/madewith` pages  
**Confidence:** high  
**Evidence:** fingerprint, resource-sanitization, persistence, reconciliation, access-control, and component tests; full `npm run agent -- verify` passed.

## Findings

1. Capture the initial page resource inventory before journey actions. Resources loaded after a CTA click describe the destination, not necessarily the audited landing page.
2. Persist sanitized, audit-owned observations as the historical source of truth. A site's current technology aggregate is useful for discovery, but cannot reproduce an old report and can outlive its public eligibility.
3. Infer removals only from two complete snapshots produced by the same detector version. Partial capture cannot establish absence, and a changed ruleset cannot establish that the website changed.
4. Build public profiles from an explicitly public, eligible completed audit at read time. Anonymous, private, or revoked reports must not become discoverable through aggregates, metadata, related sites, sitemaps, or caches.

## Prevention

- Initial-resource snapshot boundary: `lib/audit/screenshot.ts`
- Sanitization and bounds: `lib/audit/browser/network-monitor.ts`
- Versioned deterministic fingerprints: `lib/audit/tech-detect.ts`
- Audit snapshots and same-version diffs: `lib/audit/technology-profile.ts`
- Current-state reconciliation: `lib/graph/persist.ts`
- Public eligibility boundary: `lib/graph/queries.ts`
- Regression coverage: technology detector, resource monitor, profile, reconciliation, and Made with access tests
