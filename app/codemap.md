# app/ - Next.js App Router Routes

## Responsibility
Next.js App Router routes: marketing pages, auth, authenticated dashboard, audit/report pages, admin, API routes.

## Route Groups
| Route | Purpose |
|-------|---------|
| `(marketing)/` | Public pages: homepage, pricing, FAQ, help, tools, docs, changelog, roast |
| `(auth)/` | Sign-in, sign-up, forgot/reset password |
| `(app)/` | Authenticated dashboard, billing, settings |

## Key Routes
| Route | Purpose |
|-------|---------|
| `audit/[id]/` | Live audit page (polling, progressive rendering) |
| `report/[id]/` | Completed audit report |
| `admin/` | Admin dashboard |
| `api/` | All API routes |
| `compare/` | Before/after comparison |
| `demo/` | Demo page (frozen HTML fixture for audits) |
| `share/` | Shared report links |
| `llms.txt/` | LLM-friendly site documentation |

## API Routes (`api/`)
| Route | Purpose |
|-------|---------|
| `api/audits/` | Audit CRUD + enqueue |
| `api/auth/` | Auth endpoints (better-auth) |
| `api/stripe/` | Stripe webhook + checkout |
| `api/mcp/` | Model Context Protocol server |
| `api/cron/` | Cron job endpoints (CRON_SECRET gated) |
| `api/health/` | Health check endpoints |
| `api/admin/` | Admin API endpoints |
| `api/support/` | Support chat endpoints |

## Root Files
| File | Purpose |
|------|---------|
| `layout.tsx` | Root layout (providers, global styles) |
| `error.tsx` | Error boundary |
| `global-error.tsx` | Global error boundary |
| `not-found.tsx` | 404 page |
| `globals.css` | Global styles |
| `robots.ts` | robots.txt generation |
| `sitemap.ts` | sitemap.xml generation |
| `opengraph-image.jpg` | Site Open Graph share image |
| `twitter-image.jpg` | Twitter/X large-image share card |

## Integration Points
- **Middleware:** `middleware.ts` → `proxy.ts` (edge runtime, CSP, auth gating)
- **Data fetching:** Server components fetch directly via Prisma; client components use SWR
- **Auth:** `lib/auth.ts` (better-auth) for session validation
- **API routes:** Import business logic from `lib/`

## Invariants
- Edge middleware must NOT import Prisma/Node (edge runtime limitation)
- `/post-login` is the single post-auth landing (claims anonymous audits, sets `includeAi`)
- Report UI passes `productContract`, `actionTimeline`, and flag `source` into `AuditReport`
- Marketing pages use `lib/marketing/copy.ts` for all text
