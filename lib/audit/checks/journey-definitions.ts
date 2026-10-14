export const JOURNEY_VERIFICATION_RULE = 'Public journey page observation v1'
export const JOURNEY_TYPES = ['first-visit', 'pricing-evaluation', 'signup'] as const
export const JOURNEY_ASSERTIONS = {
  'landing-headline': JOURNEY_TYPES.map(type => `journey-${type}-unclear-value-prop`),
  'landing-action': ['journey-hidden-cta', ...JOURNEY_TYPES.map(type => `journey-${type}-hidden-cta`)],
  'landing-path': ['journey-dead-end', ...JOURNEY_TYPES.map(type => `journey-${type}-dead-end`)],
  'destination-headline': ['journey-first-visit-destination-no-headline', 'journey-pricing-evaluation-destination-no-headline'],
  'destination-action': ['journey-first-visit-destination-no-next-action', 'journey-pricing-evaluation-destination-no-next-action'],
  'destination-form': ['journey-signup-no-form'],
  'destination-field-count': ['journey-signup-too-many-fields'],
} as const
