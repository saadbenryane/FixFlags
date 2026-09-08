# Homepage editorial refresh · 2026-09-08

Implemented the owner's approved eight-section homepage plan on main. Scope: CareHomepage component/CSS, canonical CARE_HOME copy, focused interaction tests and captured fixture evidence. Other agents' ongoing Site, audit, billing, Shopify and test changes were preserved. No deployment performed.

## Result

- Hero retains brand/headline and URL entry, with one prominent purchase Flag plus four supporting cards. Uptime has seven daily bars and a seven-day label.
- One Canvas Tote incident connects Find, Understand, Fix and Verify. Understand is the initial step. Tabs support arrows, Home/End and roving focus. Verify explicitly illustrates an expected recovery, does not make requests, does not change the original Flag, and does not claim a repaired fixture.
- Supporting-card dialogs explain what happened, impact, next step and scope; icons are keyed by identity. Escape restores focus. Add card modifies only the local personalization example and prevents duplicates.
- Copy instructions supports success and selection fallback; nothing is sent automatically.
- Eight sections, clearer type hierarchy, dark ongoing-care section, responsive primary-Flag-first order, canonical orange/white primary CTA. Primary button labels are 19px/700 so the measured 3.13:1 orange/white pair meets the large-text threshold. Body contrast ~5.93:1; dark note contrast ~9.64:1. This is scoped inspection, not full WCAG certification.

## Evidence provenance

`components/marketing/homepage/__fixtures__/cart.html` is a controlled fixture derived from the intentionally inert Add to cart test pattern. The 720×440 screenshot at `public/marketing/evidence/cart-empty.png` was captured in the in-app browser after clicking Add to cart. The cart still showed zero items. The captured image was visually inspected. There is no fabricated healthy twin; Verify uses an explicitly labeled illustrative checklist. The fixture server was temporary; no live service is required to render the asset.

## Verification

- Scoped ESLint: passed.
- Homepage interaction tests: 6 passed. Existing AuditInput tests: 9 passed (pending request, failure/retry, validation and handoff coverage).
- Broader homepage/marketing selection: 139 passed, one unrelated legacy test failed (`shopify-customer-ready`: expects old Shopify-first HERO primary action). That test reads the older HERO contract, not CARE_HOME.
- Image local-patterns guard: passed; rendered capture loads through Next Image.
- Browser: 390/768/1280 widths, no horizontal overflow; eight sections; focus restoration; arrow/Home tab navigation; labeled simulated recovery; personalization; both URL fields' accessible empty/malformed errors. Network loading/error behavior covered by existing AuditInput tests without launching a customer scan.
- Reduced-motion rules inspected in scoped CSS and global stylesheet; no autoplay or idle demo animation. Operating-system reduced-motion preference was not changed.
- Screenshots: `/tmp/fixflags-homepage-editorial/` (desktop hero/demo, mobile board/demo, tablet demo, ongoing-care section).
- `npm run agent -- verify --dry-run` followed by `npm run agent -- verify`: attempted, stops on unrelated Product/Site/audit/Shopify type errors. Log `.agent-runs/2026-09-08T16-11-09-830Z-typecheck.log`. No homepage errors remain in that run.
- Existing global guards also fail outside this scope: SiteBoard raw hex; Site/new/Shopify design drift; legacy LandingHowItWorksSection artwork reference. Details `/tmp/fixflags-homepage-verify.log` and command output in task. No production readiness claim.

## Preview and follow-up

Local preview: http://localhost:3003 (separate `.next-homepage-editorial` build cache). Existing hero/final attribution and URL submission remain unchanged. No new event taxonomy. After an eventual release, compare existing homepage check-start and completed-check funnels over equivalent periods; no conversion uplift is claimed from this implementation. Publish only through the repository's release workflow after unrelated checks are repaired.
