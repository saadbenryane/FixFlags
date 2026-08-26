# components/ - React Components

## Responsibility
React components organized by feature area. Shared primitives in `ui/`, feature-specific components in dedicated directories.

## Key Subdirectories
| Directory | Purpose |
|-----------|---------|
| `ui/` | 33+ shadcn/ui primitives (Button, Card, Dialog, etc.) - shared across all features |
| `audit/` | Report page layout (hero, toolbar, rubrics, actions) - 48 components |
| `report/` | Flag interaction (explorer, detail panel, fix loop, scoring) |
| `marketing/` | Marketing page components (landing, features, testimonials) |
| `layout/` | Layout components (header, footer, navigation) |
| `billing/` | Billing/subscription UI (plans, checkout, invoices) |
| `settings/` | User settings UI |
| `admin/` | Admin dashboard UI |
| `dashboard/` | User dashboard UI |
| `pricing/` | Pricing page components |
| `help/` | Help Center UI |
| `auth/` | Auth page components (sign-in, sign-up) |
| `demo/` | Demo page components |
| `compare/` | Before/after comparison UI |
| `brand/` | Brand assets (logo, badges) |
| `analytics/` | Analytics dashboard UI |
| `live-support/` | Live support chat UI |
| `repo-scan/` | GitHub repo scan UI |
| `support/` | Support page UI |
| `system/` | System/utility components |
| `providers.tsx` | React context providers |
| `theme-toggle.tsx` | Theme toggle component |

## Report Component Architecture
- **`components/audit/`** owns page-level layout: hero, toolbar, rubrics, actions
- **`components/report/`** owns flag interaction: explorer, detail panel, fix loop, scoring
- **`components/ui/`** owns shared primitives: FilterPill, ScoreDot, ThumbsFeedback

## Integration Points
- **Data fetching:** Components use SWR for data fetching (`lib/api/`)
- **Styling:** Tailwind + semantic tokens (`bg-card`, `text-brand`, `shadow-card`)
- **Icons:** lucide-react
- **Forms:** React Hook Form + Zod validation
- **State:** React state + context (no global state library)

## Invariants
- Marketing copy imported from `lib/marketing/copy.ts` (never hardcoded)
- Design tokens from `lib/design/tokens.css` (never raw hex)
- shadcn/ui primitives in `components/ui/` (extend, don't replace)
- Report UI hierarchy: `knowledge/report-contract.md` only. Default route is Agent beside Report. Preview, Timeline, and Canvas stay parked.
- `repo-scan/` is parked power-user UI, not a default product surface.
