export const FLAG_LIBRARY = {
  title: 'Flag Library',
  body: 'Patterns from checked websites. Each published entry includes reviewed observations, research scope, limitations, and a fix.',
  emptyTitle: 'The library is still building.',
  emptyBody: (minimumSites: number) => `We publish a pattern after reviewing permitted evidence from at least ${minimumSites} checked websites. No reviewed patterns are available yet.`,
  docsCta: 'Understand checks and coverage',
  startCta: 'Check your website',
} as const
