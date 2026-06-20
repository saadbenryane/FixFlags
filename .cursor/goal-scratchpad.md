STATUS: DONE (iteration 2)
ITERATION: 2 / 8

# Goal: World-class audit precision + design-language detection

## Done when
- [x] Flow CTA picks hero over header Login; external booking links succeed
- [x] Flow evidence highlights use live CTA bounding box (not generic selectors)
- [x] Design token checks: font-family-sprawl, button-radius-inconsistent
- [x] Mobile CTA fold scoring aligned with flow link-scoring
- [x] Demo offline audit: v1 = 0 flags

## Iteration 2 results
| Area | Change |
|------|--------|
| Flow precision | Nav/header skip, auth deprioritized, Calendly/calendar success |
| Evidence | `ctaAnchor` captured at click time, merged after anchor resolution |
| Design language | 2 new live checks via mobile capture metrics |
| Capability matrix | 71 checks, design-tokens now live |

## Next iterations (from matrix)
- Multi-step flow (pricing nav, mobile menu, form validation)
- prefers-reduced-motion check
- AI + deterministic design language fusion
