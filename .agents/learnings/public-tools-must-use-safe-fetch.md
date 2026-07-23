# Public URL tools must use the audit safe-fetch boundary

## Finding

Public URL tools previously called `fetch()` with automatic redirects. That bypassed the audit pipeline's hostname, DNS, redirect, content-type, response-size, and private-network checks. Route rate limiting does not mitigate server-side request forgery.

## Prevention

- All server-side HTML retrieval uses `safeFetchHtml()` from `lib/audit/url.ts`.
- Every redirect target is resolved and validated before it is fetched.
- Public tools use bounded response sizes and return explicit validation errors.
- IPv6 URL hostnames are normalized without brackets before private-address checks.

## Evidence

- The meta-preview and placeholder-detector implementations contained direct `fetch(..., { redirect: 'follow' })` calls.
- `lib/tools/__tests__/public-fetch.test.ts` proves both tools use the shared boundary.
- `lib/audit/__tests__/url.test.ts` covers localhost, private IPv4, loopback IPv6, and cloud metadata destinations.
