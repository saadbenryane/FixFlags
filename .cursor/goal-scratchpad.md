STATUS: DONE (iteration 1)
ITERATION: 1 / 8

# Goal: Organized audit system — copy, flow, loading, design — verifiable locally

## Done when
- [x] `npm run audit:capabilities` — 69 checks, 29 capabilities, 0 unmapped
- [x] `npm run demo:audit` — v1 in-scope flags = 0
- [x] `npm run demo:audit:flow` — v1 flow flags = 0
- [x] `npm run test:unit` — 827 pass

## Results
| Check | Result |
|-------|--------|
| Capability matrix | 23 live, 5 planned, 1 partial (design-language AI) |
| Demo audit (live) | original 9, v1 0 |
| Demo flow (live) | original 1 (dead_end), v1 0 |
| New checks | heading-hierarchy-missing, loading-indicator-stuck |

## Next iterations (from matrix)
- Multi-step flow (pricing, mobile nav, forms)
- Social proof slop
- Design token sampling
- Form validation feedback flow
