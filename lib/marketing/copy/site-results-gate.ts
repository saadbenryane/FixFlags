/** The signup moment between an anonymous check and its results. */
export const SITE_RESULTS_GATE = {
  /** In line for a checking slot: nothing has run yet, so nothing is described as running. */
  queued: {
    title: (host: string) => `Waiting to check ${host}`,
    body: 'Your check is in line and starts as soon as a checking slot opens. Create your free account while you wait, then read the evidence and fix instructions as results arrive.',
  },
  running: {
    title: (host: string) => `Checking ${host}`,
    body: 'Create your free account to see results as checks finish, read the evidence, and get fix instructions. The same check keeps running while you sign up.',
  },
  ready: {
    title: 'Your results are ready',
    body: (host: string) => `Create a free account to see what we found on ${host}, with the evidence and the fix instructions.`,
  },
  failed: {
    title: 'This check couldn’t finish',
    body: (host: string) => `Create a free account to see what we could check on ${host} and run it again.`,
  },
  stages: ['Opening your site', 'Trying pages and actions', 'Reviewing what we found', 'Preparing your results'] as const,
  signUp: 'Sign up free to see results',
  claim: 'Save to your account and see results',
  signIn: 'Sign in',
  signInLead: 'Already have an account?',
  note: 'Free during open beta. No credit card.',
  stageDone: 'Done', stageActive: 'In progress', stagePending: 'Waiting',
  elapsed: (minutes: number) => minutes < 1 ? 'Started less than a minute ago' : `Started ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`,
  requested: (minutes: number) => minutes < 1 ? 'Requested less than a minute ago' : `Requested ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`,
  lastActivity: 'Last recorded activity',
  slow: 'This check is taking longer. Available results appear in your account while the remaining checks continue.',
  disconnected: 'We couldn’t refresh the check status. The last recorded stage is shown. This does not mean your website failed.',
  retry: 'Retry status updates',
  sample: 'Explore the interactive sample while you wait',
} as const
