export const PUBLIC_RESEARCH_COPY = {
  llmsLibraryNote: 'Reviewed aggregate research on recurring issues and fixes.',
  scopeTitle: 'Research scope',
  window: (sites: number, start: string, end: string) =>
    `${sites} reviewed sites, observed from ${start.slice(0, 10)} to ${end.slice(0, 10)}.`,
} as const

export const RESEARCH_CONSENT_COPY = {
  title: 'Website quality research',
  body: 'Help others build better websites by allowing FixFlags to use new check findings and independently verified fix outcomes from this Site in anonymized, aggregated public research.',
  choice: 'Allow this Site to contribute to website quality research',
  boundary: 'Your domain, URLs, screenshots, page content, prompts, account details, and connected analytics or search data are excluded. Only observations collected after you opt in are eligible. Research requires review and a sample of at least 20 distinct websites.',
  withdrawal: 'This is optional and does not affect monitoring. You can withdraw at any time. FixFlags will stop using this Site in research and withhold affected published research until it is reviewed again.',
  loading: 'Loading research permission…',
  unavailable: 'Research permission could not be loaded.',
  saving: 'Saving research permission…',
  saved: 'Research permission saved.',
  failed: 'Research permission could not be confirmed. Try again to check your saved choice.',
  retry: 'Try again',
} as const
