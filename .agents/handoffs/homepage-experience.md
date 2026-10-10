---
status: supporting
authority: evidence
reviewed_at: 2026-10-10
supersedes: []
---

# Homepage experience continuation

The founder approved implementation and the homepage slice is implemented locally, without deployment. The brand remains **Your software runs. FixFlags watches.** Approved direction is recorded in [DECISIONS.md](../../DECISIONS.md) and [voice-and-copy.md](../../docs/voice-and-copy.md). The earlier [experience review](../../docs/experience-review.md) is research evidence, not a current implementation specification.

## Delivered

- Four moments: brand and real URL entry; seven-category interactive board; coherent sample Flag recovery; configured monitoring and final URL entry. Large comparison and standalone integration/coverage explanations are removed from this page; useful coverage and connections live in depth.
- Shared BoardCard uses consistent 18px answer typography, wrapping labels, neutral surfaces, visible status and one whole-card interaction. Unknown, partial, stale and unconfigured states never imply a pass. Desktop sample uses four columns with Pages spanning two; tablet uses two and phones one.
- Every category exposes results, scope, freshness and limitations through the existing ResponsiveDepth. Conversion separates the checkout Flag from unconfigured Safe Signup. Flag depth uses matching captures, scoped guidance, selectable clipboard fallback, and explicitly sample recovery.
- Pricing HTTP 404 now has its own controlled local capture, `public/marketing/evidence/pricing-unavailable.png`; the homepage thumbnail is identity, not proof. Checkout uses the existing broken/recovered cart fixtures. Other diagnostic results and schedules are explicitly illustrative. No real customer measurements, history or verification run is fabricated.
- Schedule explains two configured behaviors, their scope, last and next execution, and an unconfigured Signup. Daily example checks do not imply instant detection or recurring diagnostics across all categories. The schedule is identified as the later snapshot after checkout recovery.
- All new customer copy remains in `lib/marketing/copy/care-homepage.ts`. No entitlement, billing, pricing, quota, scheduling or backend execution logic changed. The rejected 60-day grant and numerical limits are not approved policy.

## Validation and evidence

- Isolated production build passed with type and build lint validation. Component/marketing/board suite: 95 files, 510 tests passed; final focused homepage/shared-card suite: 18 tests passed, including three new unknown-state cases. Repository lint, brand, UI drift, image, SEO and route-metadata guards passed.
- Production-rendered Playwright: 12 tests passed at 320, 390, 768, 1086, 1280 and 1440px. No overflow or browser exceptions; verified category/Flag/proof interactions, viewport-height phone depth, keyboard opening/Escape/focus restoration, URL-field focus, reduced motion, slider keyboard operation, and mocked API-to-Site handoff.
- Actual screenshots: `.agents/artifacts/homepage-experience/{desktop,mobile,desktop-board,mobile-board,desktop-depth,mobile-depth,mobile-flag}.png`. Visually inspected desktop, phone and phone depth after refinement. Accessibility report lives alongside them in `accessibility.json`.
- Automated WCAG A/AA sample board, category and Flag depth checks have no violations. Retained brand CTA exception: white 14px text on #FF5A00 has approximately 3.12:1 contrast. DESIGN.md and the design skill explicitly retain owner-requested white labels; this pass did not revise that palette policy. Do not claim page-wide AA compliance.
- Skills validation, knowledge duplication guard, agent doctor and diff checks pass. Extra development server was stopped after repeated recompilation; final browser proof uses the stable isolated production runtime on port 3115. Existing port 3000 development process was preserved.

## Next

Review the rendered direction, then bring the same coverage and status clarity into the real first-analysis → monitoring activation experience. This homepage proves the presentation and existing submission handoff, not a credentialed live analysis/recovery cycle or production scheduling reliability. Sample content remains illustrative; no new backend capabilities are implied. Commercial validation needs measured costs and customer behavior before any entitlement change.
