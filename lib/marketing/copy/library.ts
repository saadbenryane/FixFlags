export const FLAG_LIBRARY = {
  title: 'Flag Library',
  body: 'Patterns from checked websites. Each published entry includes the observed frequency, affected frameworks, examples, and a fix.',
  emptyTitle: 'The library is still building.',
  emptyBody: (minimumSites: number) => `We publish a pattern once it has evidence from at least ${minimumSites} checked websites. No patterns have reached that threshold yet.`,
  docsCta: 'Understand checks and coverage',
  startCta: 'Check your website',
} as const
