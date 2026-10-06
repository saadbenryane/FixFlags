# Security

*Assets, trust boundaries, invariants, and dangerous operations.*

## Assets

| Asset | Location / type | Sensitivity |
|-------|----------------|-------------|
| Database credentials | `DATABASE_URL` env | Critical |
| Redis credentials | `REDIS_URL` env | Critical |
| AI API keys | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | Critical |
| Auth secret | `BETTER_AUTH_SECRET` | Critical |
| Stripe secret key | `STRIPE_SECRET_KEY` | Critical |
| Stripe webhook secret | `STRIPE_WEBHOOK_SECRET` | Critical |
| GitHub tokens | `GithubConnection.encryptedToken` (DB) | High (access user repos) |
| R2 credentials | `R2_*` env vars | High |
| Email API key | `RESEND_API_KEY` | Medium |
| Cron auth | `CRON_SECRET` | Medium |
| User data | `User` table (email, name) | Medium |
| Audit data | `Audit`, `AuditPage`, `Flag` tables | Low-Medium (URLs, page content) |

## Trust boundaries

1. **Edge ↔ Server:** Edge middleware (`proxy.ts`) runs on Vercel Edge Runtime. Must NOT import Prisma/Node modules. Only checks cookie presence (not validity) for UX gating. Server validates session on every protected route.
2. **Client ↔ Server:** All API routes validate authentication server-side. Cookie-based session. CSRF protection via same-site cookies.
3. **Worker ↔ Queue:** BullMQ uses Redis. No additional auth on local Redis. Production Redis should require `AUTH`.
4. **External ↔ Application:** Stripe webhooks via signature verification. Cron endpoints via `CRON_SECRET` bearer token. MCP via API key (hashed, prefixed `ff_live_`).
5. **GitHub API:** Tokens encrypted at rest. Only used for repo scanning (Studio plan).
6. **Public URL fetches:** Audit capture, meta preview, placeholder detection, fixture capture, and graph backfills use `safeFetchHtml()`. It validates DNS and each redirect target, rejects private/reserved networks, requires HTML, and bounds response size.

## Authentication invariants

- better-auth 1.6 with Prisma adapter (PostgreSQL)
- Email/password + Google OAuth + GitHub OAuth resolved at runtime
- Passkeys via `@better-auth/passkey` (WebAuthn). Users register passkeys in Settings, sign in with passkey, or use passkey as the second factor after password.
- Optional passkey 2FA via better-auth `twoFactor` plugin (`skipVerificationOnEnable`, TOTP disabled). Email/password sign-in with `twoFactorEnabled` issues a challenge cookie; completion is passkey assertion or a one-time backup code. Enabling 2FA requires at least one registered passkey.
- Session cookie: `better-auth.session_token` (dev), `__Secure-*` / `__Host-*` (production)
- No Prisma import on edge — `proxy.ts` does cookie-presence check only
- Protected pages (`/admin/`, `/settings/`) gated by middleware; server validates session on API routes
- admin role configured via `ADMIN_USER_IDS` env var
- Newly created developer keys carry an explicit MCP permission set and a 30, 90, or 365 day expiry. The default is read-only evidence for 90 days. CLI device approval issues a 90-day key for the complete Fix → Verify workflow. Existing empty-scope account keys retain their historical full-access behavior until the owner replaces or revokes them; every non-empty scope set is enforced even without an OAuth audience.

## Report access invariants

- Anonymous report claims use an HttpOnly, SameSite=Lax HMAC proof scoped to one audit ID and a bounded expiry. A raw or tampered audit ID cannot transfer ownership.
- `/post-login` awaits the anonymous claim before passkey enrollment or onward navigation. A failed claim leaves the user on the recovery screen.
- Anonymous report responses may include confirmed Flags, public screenshots, textual evidence, rubric results, and deterministic scan messages.
- Anonymous live-report responses omit fix prompts, Timeline events and playback metadata, pipeline logs, owner and plan state, Product Memory, private history, Canvas data, and watch configuration.
- Repository-owned curated samples may ship versioned static Timeline fixtures because they contain no production report payload or private viewer data.
- `/report/[id]` is the canonical public evidence URL. Copy link is the share action.
- Legacy `/share/[token]` reads remain compatibility-only. The product no longer creates or manages protected share links. Do not treat `ShareLink.passwordHash` as a live product contract.
- Canvas is private to the paid report owner. Generated documents are schema-validated, evidence-grounded, and cannot contain executable markup, external resources, or inaccessible source references.

## Secrets management

- All secrets are environment variables
- `.env.local` is gitignored
- No hardcoded secrets, tokens, or passwords in source
- GitHub tokens encrypted with AES-256-GCM via `TOKEN_ENCRYPTION_KEY`
- API keys are SHA-256 hashed, stored with an `ff_live_` prefix hint and last four characters only, shown once at creation, permission-scoped, expiring, and revocable. Listing keys never returns the hash or secret.
- Stripe webhook signature verified on every event

## Production access

- Railway deployment. No direct SSH or DB access without Railway dashboard.
- Database: PostgreSQL 16, accessible only within Railway network.
- Paid-opening evidence may query production Watch records only through the operator-supplied `RELEASE_WATCH_READ_DATABASE_URL`. The release command starts a read-only transaction, serializes only aggregate metrics and a database identity hash, and refuses the disposable release database.
- Redis: accessible only within Railway network.
- No admin accounts in code — seeded via `npm run db:seed` with dev-only credentials.

## Dangerous operations

| Operation | Risk | Guard |
|-----------|------|-------|
| `npm run reset` | Database reset | Not implemented (add guard when created) |
| `prisma migrate reset` | Data loss | Requires confirmation |
| `prisma db push` | Schema drift in prod | Should only use `migrate deploy` in prod |
| Direct DB mutation | Data corruption | Admin dashboard only |
| Worker force-kill | Stuck audits | Recovery scheduler handles within 15 min |

## Rate limiting

`lib/security/rate-limit.ts` uses Redis counters. On Redis connection failure it **fails open** (allows the request) so a Redis outage does not take the product offline. This is an intentional availability tradeoff, not a silent bug. Product quota gates (anon teaser, Free lifetime, plan limits) remain enforced in application code independent of Redis.

Product Signal ingestion is the explicit exception.

`/api/products/[id]/signals` fails closed when rate limiting is unavailable because an ingestion outage is safer than accepting an unbounded event stream.

## Product Signal privacy boundary

- Signal write keys are stored hashed, scoped to one Product, bound to one exact HTTP(S) origin, and revocable.
- A completed Product Review is required before a key can be issued.
- The ingestion schema rejects undeclared fields and accepts only navigation, named action/outcome, error type, bounded performance value, release, pathname, anonymous session token, event id, and timestamp.
- Query strings, fragments, input values, form contents, DOM text, identity, headers, bodies, keystrokes, and replay data are not stored.
- Anonymous session tokens are one-way hashed with Product scope before persistence.
- Client event IDs have a Product/source uniqueness constraint for replay protection.
- Raw signals carry a 30-day expiry and are deleted by the worker retention sweep.
- Derived Improvements and verified learning keep Review and evidence provenance without retaining expired raw payloads.

## Dependency risks

- Playwright: production Docker uses system Chromium (no browser download in image); local may use Playwright-managed browser
- Next.js 15: regular updates, check security advisories
- better-auth 1.6: relatively new auth library, audit updates
- BullMQ 5: relies on Redis security
- Runtime packages: `npm run security:audit` blocks every moderate-or-higher advisory.
- Build-only packages: the same gate accepts only exact reviewed advisory URLs and indirect dependency paths recorded in [docs/security/toolchain-risk.md](docs/security/toolchain-risk.md). A new advisory, direct dependency, runtime path, or dependency drift blocks release.

## Prompt injection risks

- User-provided URL → page content sent to AI. Page text trimmed to 2500/5000 chars (see `lib/audit/page-text-limits.ts`). Sanitized before prompt injection.
- Sanitization: `lib/audit/metadata.ts` `sanitizeText()` strips scripts, event handlers, embedded content.
- AI prompt templates in `lib/prompts/system-prompt.ts` do not interpolate raw user input into system instructions.

## Billing (production)

- Revenue deploys set `BILLING_REQUIRED=true` and the full Stripe set (secret, webhook secret, five price IDs). Partial config fails boot via `validateStripeBillingEnv`.
- Test vs live is key prefix only (`sk_test_` / `sk_live_`). Never mix test price IDs with live keys.
- Webhook events: `customer.subscription.*`, `invoice.payment_failed|payment_succeeded`, `checkout.session.completed|expired`, `charge.refunded`.
- Operator setup: `docs/stripe-setup.md`. Never commit secrets; use `.env.local` + Railway variables.

## Approval requirements

| Action | Approval |
|--------|----------|
| Schema changes | `npm run db:check` + `npm run db:drift` |
| env.example changes | Review for secrets exposure |
| Worker index.ts changes | Full audit cycle test |
| Middleware/proxy.ts changes | Verify edge compatibility (no Node imports) |
| Stripe webhook handler | Verify signature verification + plan sync on payment_failed |
| AI prompt changes | Verify prompt injection safety |

## Out of scope

- Penetration testing (pre-revenue, no sensitive user data)
- SOC2 / compliance (pre-revenue)
- VPC / network isolation (Railway managed)
- Secrets rotation policy (single founder, manual rotation)
