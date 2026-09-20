export const INTEGRATIONS_PAGE = {
  hero: {
    label: 'Integrations',
    title: 'More context. Better Flags.',
    body: 'Start with a URL. Add a connection when it helps FixFlags understand what matters to your website.',
  },
  available: {
    label: 'Available now',
    title: 'Shopify',
    body: 'Shopify adds store structure and an independent purchase-path journey to the same FixFlags Site.',
    facts: ['Product and store context', 'Product-to-checkout browser journey', 'Evidence when customers cannot buy'],
    action: 'Connect Shopify',
  },
  future: {
    label: 'Coming later',
    title: 'Context that sharpens the answer.',
    body: 'These connections are planned. They are not available to connect yet.',
    items: [
      { title: 'Analytics', body: 'Understand which pages and journeys people use.' },
      { title: 'Search Console', body: 'Add search-performance context to the pages FixFlags already knows.' },
      { title: 'Deployments', body: 'Relate an important change to the moment it appeared without guessing at the cause.' },
    ],
  },
  close: {
    title: 'Your website works without a connection.',
    body: 'Analyze the live site first. Add context when it makes the next Flag more useful.',
  },
} as const
