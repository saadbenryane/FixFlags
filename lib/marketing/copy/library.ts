export const FLAG_LIBRARY = {
  title: 'Flag Library',
  body: 'Website problems worth learning from. Published patterns include reviewed evidence, limits, and fix guidance.',
  emptyTitle: 'The library is still building.',
  emptyBody: (minimumSites: number) => `We publish a pattern after reviewing permitted evidence from at least ${minimumSites} checked websites. No reviewed patterns are available yet.`,
  docsCta: 'Understand checks and coverage',
  startCta: 'Check your website',
} as const
