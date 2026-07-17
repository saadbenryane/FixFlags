# Homepage visual system

## Decision

The homepage uses three layers of visual proof:

1. The real report explorer is the product proof. Do not add a second report mockup.
2. Message, Experience, and Reach use one continuous physical-metaphor panorama.
3. Scan, Flag, Fix, and Re-check use one continuous process diorama.

Generated imagery contains no text, scores, logos, or fake product UI. All labels and evidence remain semantic HTML so they stay accurate, accessible, and responsive.

## Art direction

- Warm limestone, frosted glass, translucent Flag Orange, soft daylight, calm editorial composition.
- Dark companions use graphite, charcoal stone, smoked glass, and controlled orange light.
- The orange material is a signal and connective thread, not a generic glow.
- Supplied brand boards and collages are references only. Their embedded typography, copy, and UI are not canonical.
- The glass flag portrait is brand punctuation for the final CTA, not an explanatory illustration.

## Assets

- `public/marketing/visuals/rubrics-light.webp`
- `public/marketing/visuals/rubrics-dark.webp`
- `public/marketing/visuals/loop-light.webp`
- `public/marketing/visuals/loop-dark.webp`

Desktop renders each panorama as one integrated scene. Mobile uses deterministic CSS crops from the same master, which preserves consistency without loading separate generated assets.

## Layout boundaries

- Do not restore the detached, rotated `brand-product-moments` image in the loop section.
- Do not restore the grid behind the marketing hero. The warm wash and physical imagery provide enough depth.
- Static rubric and loop panels should not use hover/press motion that implies clickability.
- Feedback headings use one h2 only. Illustrative feedback must keep a visible disclosure.
- A one-sided full-bleed rail can align to a centered container and reach the right viewport edge with `width: calc(50vw + 50%)`.
