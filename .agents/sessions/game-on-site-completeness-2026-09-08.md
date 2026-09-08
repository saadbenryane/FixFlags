# Game On Site completeness

Date: 2026-09-08
Owner: cursor-seo-loop
Branch: main

## Outcome

The Site loop is designed, not wrapped. A stranger can enter a URL, land on `/sites/{id}`, see coverage-honest status, open a Flag, copy a fix, Verify with `READY_TO_VERIFY`, and Keep watching with an honest schedule. Production runs this code.

## Production proof

| Check | Result |
| --- | --- |
| Game On commits | `6024ce85` Site loop + Next lint; `e76ef09f` www→apex 308 |
| Live `/api/health` | `6e9c14291dbcd7894ca79bd0f5c3d7cd61b28b22` matches `origin/main` |
| Railway **FixFlags** | SUCCESS on that SHA |
| Railway **FixFlags Worker** | SUCCESS on that SHA |
| `web` service | Left alone (Aug 19 SUCCESS, no custom domain) |
| `npm run growth:verify-live` | pass: www 308, homepage “looked after”, sitemap `::page:` = 0, `/pricing` and `/partners` titles, issue 200 |

Stranger dogfood (production POST `/api/checks` `https://www.iana.org`):

- Response: `siteId` `p_cmtt3ssok0005o7207bjy5lly`, `siteUrl` `/sites/p_...`, not a `/report` fallback
- Claim cookie `ff_anon_report_ids` required; curl without it 404s (tenancy)
- With cookie, Site board 200: “Learning your website”, Checking, Coverage, Keep watching. Not “Looking good”

## Loop

- Site card is not healthy from zero Flags when starter areas are unknown. `PARTIAL` is not an AuditStatus.
- Verify records `READY_TO_VERIFY`, scopes capture to the Flag page (`SINGLE`), copy never resolves.
- Watch: Free weekly allowed. Pause keeps interval, clears `nextRunAt`. Board shows watching / paused / delayed / quota. “You’re covered” only after a schedule write.
- Status and keep-email use provisional `p_*` ids. `/products/[id]` stays a redirect. ProductWorkspace is parked.
- www.fixflags.com 308 to https://fixflags.com/

## Public story

Help getting-started, Docs, llms notes, auth, keep-email, nurture, billing pause, usage meter, root metadata, roast (noindex, Site CTA), FAQ changelog, and plans upsell language match URL-first care. Shopify remains a connection. Homepage CSS left to other owners.

## Proof (local)

`npx tsc --noEmit --incremental false` and `npx next lint` passed. Vitest slices `app/api`, `app/`, `lib/audit/`, `components/`, `lib/marketing/` passed. `copy-drift-check` and `help:catalog-guard` passed. Full-repo `npm run lint` still fails on `prototypes/fixflags-board/dist`; Railway uses `next lint`. `ui:drift-guard` still fails on pre-existing SiteBoard `/new` ShopifyWorkspace `font-display`.

## Gaps

Owned contact-form fixture through worker+browser was not a separate lab Site; homepage evidence images remain the controlled sibling. Later `main` commits from other owners rode the same Railway train; Game On behavior is in the ancestry of the matched SHA.
