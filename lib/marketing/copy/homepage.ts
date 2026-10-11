import { ANALYZE_CTA } from './terminology'

/** Compatibility action for report and not-found entry points. */
export const HERO = { primaryCta: ANALYZE_CTA, primaryHref: '/new' } as const

/** These labels describe the retained three-rubric sample, not the Site board taxonomy. */
export const SAMPLE_RUBRIC_COPY = [
  { id: 'message', title: 'Message', question: 'Do people understand what this is and why it matters?' },
  { id: 'experience', title: 'Experience', question: 'Can people do what they came to do?' },
  { id: 'reach', title: 'Reach', question: 'Can people find it and share it clearly?' },
] as const
