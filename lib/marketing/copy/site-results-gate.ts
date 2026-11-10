/** The signup moment between an anonymous check and its results. */
export const SITE_RESULTS_GATE = {
  running: {
    title: (host: string) => `Checking ${host}`,
    body: 'We’re opening your site and trying it like a visitor. Create your free account while it runs, and your results will be waiting.',
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
} as const
