# lib/ — Core Business Logic

## Responsibility
Core business logic for FixFlags: audit engine, queue, billing, graph, prompts, MCP, marketing, help, design, auth, storage, email.

## Key Subdirectories
| Directory | Purpose | Codemap |
|-----------|---------|---------|
| `audit/` | Audit pipeline (runner, checks, scoring, flow, judge, persist, capture) | [lib/audit/codemap.md](lib/audit/codemap.md) |
| `queue/` | BullMQ queue (client, worker, inline-worker, recovery) | [lib/queue/codemap.md](lib/queue/codemap.md) |
| `billing/` | Subscription limits, credits, Stripe integration | [lib/billing/codemap.md](lib/billing/codemap.md) |
| `graph/` | Knowledge graph (persist, queries, snapshot) — internal only | — |
| `prompts/` | AI system prompts (triage + prescription) | — |
| `marketing/` | Copy SSoT, metadata, SEO, structured data | — |
| `help/` | Help Center catalog, search, contextual hrefs, SLA | — |
| `mcp/` | Model Context Protocol server (14 tools) | — |
| `design/` | Design tokens, brand spec | — |
| `auth/` | Auth utilities (better-auth integration) | — |
| `storage/` | File storage (Cloudflare R2, local fallback) | — |
| `email/` | Transactional email (Resend) | — |
| `report/` | Report data shaping utilities | — |
| `live-support/` | Live support chat | — |
| `repo-scan/` | GitHub repo scanning | — |
| `analytics/` | Analytics integrations (GA4, PostHog) | — |
| `integrations/` | Third-party integrations | — |
| `security/` | Security utilities (encryption, hashing) | — |
| `admin/` | Admin utilities | — |
| `account/` | Account management | — |
| `leads/` | Lead tracking | — |
| `site/` | Site utilities | — |
| `demo/` | Demo fixtures | — |
| `logger/` | Logging (pino) | — |
| `utils/` | Shared utilities | — |

## Standalone Files
| File | Purpose |
|------|---------|
| `auth.ts` | better-auth configuration |
| `auth-client.ts` | Auth client utilities |
| `db.ts` | Prisma client singleton |
| `env.ts` | Environment variable validation |
| `stripe.ts` | Stripe client initialization |
| `logger.ts` | Pino logger instance |
| `cn.ts` | `cn()` utility (clsx + tailwind-merge) |
| `utils.ts` | Shared utilities (`rubricIcon()`, etc.) |
| `rubric-icons.ts` | Rubric icon mappings |
| `get-app-url.ts` | App URL resolution |
| `scheduled-monitoring.ts` | Scheduled monitoring config |

## Integration Points
- **App routes:** `app/api/` imports from `lib/` for business logic
- **Components:** `components/` imports data-shaping utilities from `lib/`
- **Workers:** `lib/queue/` and `worker/` import audit pipeline from `lib/audit/`
- **Edge middleware:** `proxy.ts` must NOT import from `lib/` (edge runtime limitation)
