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
5. **GitHub API:** Tokens encrypted at rest. Only used for repo scanning (Agency plan).

## Authentication invariants

- better-auth 1.6 with Prisma adapter (PostgreSQL)
- Email/password + Google OAuth + GitHub OAuth resolved at runtime
- Passkeys via `@better-auth/passkey` (WebAuthn). Users register passkeys in Settings, sign in with passkey, or use passkey as the second factor after password.
- Optional passkey 2FA via better-auth `twoFactor` plugin (`skipVerificationOnEnable`, TOTP disabled). Email/password sign-in with `twoFactorEnabled` issues a challenge cookie; completion is passkey assertion or a one-time backup code. Enabling 2FA requires at least one registered passkey.
- Session cookie: `better-auth.session_token` (dev), `__Secure-*` / `__Host-*` (production)
- No Prisma import on edge — `proxy.ts` does cookie-presence check only
- Protected pages (`/admin/`, `/settings/`) gated by middleware; server validates session on API routes
- admin role configured via `ADMIN_USER_IDS` env var

## Secrets management

- All secrets are environment variables
- `.env.local` is gitignored
- No hardcoded secrets, tokens, or passwords in source
- GitHub tokens encrypted with AES-256-GCM via `TOKEN_ENCRYPTION_KEY`
- API keys hashed with bcrypt (or similar), stored with `ff_live_` prefix
- Stripe webhook signature verified on every event

## Production access

- Railway deployment. No direct SSH or DB access without Railway dashboard.
- Database: PostgreSQL 16, accessible only within Railway network.
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

## Dependency risks

- Playwright: production Docker uses system Chromium (no browser download in image); local may use Playwright-managed browser
- Next.js 15: regular updates, check security advisories
- better-auth 1.6: relatively new auth library, audit updates
- BullMQ 5: relies on Redis security
- All npm packages: regular `npm audit`

## Prompt injection risks

- User-provided URL → page content sent to AI. Page text trimmed to 2500/5000 chars (see `lib/audit/page-text-limits.ts`). Sanitized before prompt injection.
- Sanitization: `lib/audit/metadata.ts` `sanitizeText()` strips scripts, event handlers, embedded content.
- AI prompt templates in `lib/prompts/system-prompt.ts` do not interpolate raw user input into system instructions.

## Approval requirements

| Action | Approval |
|--------|----------|
| Schema changes | `npm run db:check` + `npm run db:drift` |
| env.example changes | Review for secrets exposure |
| Worker index.ts changes | Full audit cycle test |
| Middleware/proxy.ts changes | Verify edge compatibility (no Node imports) |
| Stripe webhook handler | Verify signature verification |
| AI prompt changes | Verify prompt injection safety |

## Out of scope

- Penetration testing (pre-revenue, no sensitive user data)
- SOC2 / compliance (pre-revenue)
- VPC / network isolation (Railway managed)
- Secrets rotation policy (single founder, manual rotation)
