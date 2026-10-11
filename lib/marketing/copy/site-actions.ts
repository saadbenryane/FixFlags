export const SITE_ACTION_COPY = {
  interrupted: 'Connection interrupted. Your last recorded evidence is still available. Try again.',
  signIn: 'Your session expired. Sign in again to continue.',
  invalidResponse: 'FixFlags could not confirm this action. Refresh before trying again.',
  added: 'Card added. Verify it for fresh evidence. Your Watch schedule is unchanged.',
  currentResults: 'Current results', previousResults: 'Previous evidence', moreResults: 'Load more recorded results',
  expected: 'Expected', evidence: 'View originating evidence', resultScope: 'Each result applies only to its recorded page, time, and execution. Module completion does not certify every assertion or the whole category.',
  loading: 'Loading results…', historyFailed: 'Could not load more results. Try again.',
  refreshPending: 'The action was saved. Refresh to see the latest state.',
} as const
