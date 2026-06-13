/** Minimal marketing strings bundled into client components. */
export const UPSELLS = {
  anon: {
    headline: 'Don\u2019t lose this report',
    body: 'Create a free account to save history and get 3 scan tokens total.',
    primaryCta: 'Create free account',
    secondaryCta: 'See paid plans',
  },
  freeUser: {
    headline: (hiddenCount: number) =>
      hiddenCount > 0
        ? `You have ${hiddenCount} hidden issue${hiddenCount !== 1 ? 's' : ''}`
        : 'Unlock full reports + re-check',
    body: 'Upgrade to see all findings and re-check after fixes.',
    cta: 'Upgrade to Builder — $49/mo',
  },
  areaGate: {
    hiddenFindings: (count: number) =>
      `+${count} more issue${count !== 1 ? 's' : ''} your agent could fix right now`,
    upgradeBody: 'Upgrade to Builder to see all findings and the full area prompt',
    areaPrompt: 'Upgrade for area prompt',
    unlockReport: 'Unlock full report',
  },
  atLimit: 'Token limit reached. Upgrade to continue',
} as const

export const AUDIT_PROGRESS = {
  capturing: 'Taking screenshots...',
  checking: 'Running automated checks across performance, SEO, accessibility, and more...',
  judging: 'AI is analyzing your page...',
  completed: 'Report ready',
  inProgress: 'Auditing your site...',
  usuallyUnder: 'Usually under 60 seconds',
  stages: [
    { status: 'QUEUED', label: 'Starting audit', subtitle: 'Preparing your report...' },
    { status: 'CAPTURING', label: 'Capturing your page', subtitle: 'Desktop and mobile screenshots...' },
    { status: 'CHECKING', label: 'Running checks', subtitle: 'Performance, SEO, accessibility, and more...' },
    { status: 'JUDGING', label: 'AI review', subtitle: 'Turning findings into fix prompts...' },
  ],
  activity: [
    'Measuring load speed and Core Web Vitals...',
    'Checking SEO tags and link preview metadata...',
    'Scanning accessibility on images and headings...',
    'Reviewing trust signals like HTTPS and privacy links...',
    'Testing mobile layout and performance...',
    'Looking for conversion gaps in your hero and CTAs...',
    'Validating page structure and indexing signals...',
    'Checking console errors and broken resources...',
    'Reviewing meta tags and social sharing setup...',
    'Analyzing content clarity and call-to-action placement...',
    'Evaluating performance bottlenecks and render blocking...',
    'Cross-checking accessibility on forms and navigation...',
    'Summarizing findings for your fix prompts...',
    'Prioritizing issues by launch impact...',
    'Preparing your graded report...',
  ],
} as const
