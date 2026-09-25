export const INTEGRATIONS_PAGE = {
  hero: {
    label: 'Integrations',
    title: 'Context beside the Flag.',
    body: 'Start with a URL. Add a connection when it helps FixFlags understand the page that needs attention. Connections add context. They do not mark an Outcome Clear.',
  },
  items: [
    {
      id: 'shopify',
      title: 'Shopify',
      body: 'Adds the store and an independent walk from the product to checkout, on the same Site.',
      limit: 'A Flag can show that customers cannot buy.',
      action: 'Connect Shopify',
      href: '/install',
    },
    {
      id: 'analytics',
      title: 'Analytics',
      body: 'Shows which watched pages people open. The counts sit beside the Flag.',
      limit: 'Session counts do not decide Clear.',
      action: 'Connect in Site settings',
      href: '/integrations#analytics',
    },
    {
      id: 'search-console',
      title: 'Search Console',
      body: 'Shows the queries and pages that earn impressions, next to the check FixFlags already ran.',
      limit: 'Search numbers do not decide Clear.',
      action: 'Connect in Site settings',
      href: '/integrations#search-console',
    },
    {
      id: 'github',
      title: 'GitHub',
      body: 'Sign in with GitHub. Send the Flag, with the page and the proof, to the agent working in the repository.',
      limit: 'FixFlags does not scan the repository or edit the code.',
      action: 'Sign in with GitHub',
      href: '/sign-in',
    },
  ],
  close: {
    title: 'Your website works without a connection.',
    body: 'Analyze the live site first. Add context when it makes the next Flag more useful.',
  },
} as const
