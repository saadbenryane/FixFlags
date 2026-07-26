# Homepage reference QA

## Comparison target

- Source visual truth:
  - `/Users/saadbenryane/Pictures/Photos Library.photoslibrary/resources/derivatives/0/0920A529-3F80-40D3-A860-98C7D4478ADE_1_105_c.jpeg`
  - `/Users/saadbenryane/Pictures/Photos Library.photoslibrary/resources/derivatives/7/7C295C7C-75A8-406B-92E5-90002BE7CCCA_1_105_c.jpeg`
  - The remaining supplied 1086 × 724 references for dimensions, value, workflow, CTA, and footer art direction.
- Browser-rendered implementation:
  - `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-hero-final-clean-1086x724.png`
  - `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-sample-final-1086x724.png`
  - `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-mobile-hero-375x812.png`
- Side-by-side evidence:
  - `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-hero-comparison-1086x724.png`
  - `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-sample-comparison-1086x724.png`
- Desktop viewport: 1086 × 724 CSS px, device scale factor 1.
- Mobile viewport: 375 × 812 CSS px, device scale factor 1.
- State: logged out, light theme, homepage at rest. The sample comparison includes the sticky marketing header because it is part of the real homepage route.
- Density normalization: source and desktop implementation are both 1086 × 724, so no resampling was required.

## Findings

No actionable P0, P1, or P2 differences remain.

The implementation now matches the source’s major composition: wide transparent header, left-aligned two-line outcome headline, orange URL action, product-truth assurance row, large physical glass report object, dense sample-report split, divided value features, contained integration workflow, and compact CTA-to-footer handoff.

Accepted intentional differences:

- Navigation keeps the canonical four destinations. It does not add a duplicate “How it works” destination beside “Product.”
- Trust content does not reproduce the reference’s unsupported avatar row, builder count, manual-review percentage, or other invented proof.
- Report values, issue labels, and rubric counts come from the shipped sample model rather than the illustrative values in the reference.
- The development capture includes the existing support control. It is not part of the recreated visual content.

## Required fidelity surfaces

- Fonts and typography: Inter Tight display and Inter UI preserve the reference hierarchy, optical weight, two-line hero wrap, compact mono eyebrows, and readable small report text. No truncation affects primary marketing copy.
- Spacing and layout rhythm: the header, hero copy, URL action, assurance line, editor marks, glass object, sample split, feature dividers, integration card, CTA, and footer align to the reference’s contained 1086px composition. Desktop and 375px mobile show no horizontal overflow.
- Colors and visual tokens: the warm white canvas, ink text, restrained stone surfaces, soft glass shadows, and single orange signal use canonical tokens. Contrast remains legible in the tested light state.
- Image quality and asset fidelity: the supplied RGBA hero master was tightly cropped to its visible alpha bounds and rendered as a real WebP asset. It has no white fringe, black halo, stretching, or CSS-drawn replacement.
- Copy and content: headings and labels follow the references where they agree with product truth. Claims, counts, navigation, Message/Experience/Reach terminology, and Re-check language remain canonical.

## Focused evidence

- Hero: exact-size side-by-side comparison confirms matching header height, copy baseline, CTA width, assurance placement, illustration scale, and fold position.
- Sample report: exact-size side-by-side comparison confirms the same left narrative/right product-proof hierarchy and report density. The live route’s sticky header and honest sample values are intentional.
- Supporting sections: browser captures verify the five divided benefits, contained workflow card, final CTA, and footer use the same visual system. Further crops were not needed because their critical type, spacing, icon, and card treatments are clearly readable in the viewport captures.

## Comparison history

1. Initial desktop comparison found three P2 issues: the header was constrained too narrowly, the hero began too high, and transparent padding made the glass object appear undersized.
2. The marketing container and header rhythm were widened, the hero fold was rebalanced, and the source image alpha bounds were measured and cropped into a dedicated asset.
3. The sample report was densified to preserve the source’s wide dashboard proportion, feature dividers were added, and supporting cards were aligned to the wider marketing container.
4. Post-fix desktop and mobile captures show the P2 issues resolved. A clean browser tab reports no console warnings or errors.

## Interaction and responsive checks

- Empty hero submission shows `Enter a URL like https://yoursite.com`.
- The mobile menu opens and exposes Product → `/how-it-works` and Log in.
- `/`, `/how-it-works`, `/samples`, `/pricing`, `/help`, `/sign-in`, `/privacy`, and `/terms` returned HTTP 200 locally.
- The 375 × 812 hero keeps the headline, explanation, URL action, assurances, trust line, and editor marks readable without horizontal overflow.
- Clean-load browser console: no errors or warnings.

## Follow-up polish

- P3: the live support control slightly changes the clean-room screenshot composition, but it is an existing product surface and not a homepage fidelity defect.

final result: passed
