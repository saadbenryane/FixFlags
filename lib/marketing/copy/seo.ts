export const SEO = {
  home: {
    title: 'FixFlags - Your website, looked after.',
    description:
      'FixFlags monitors your live website with 100+ automated tests and real browser journeys. When something matters, you get a Flag.',
  },
  protect: {
    title: "Protect the path that makes money",
    description:
      'FixFlags walks your Shopify purchase path and tells you if customers can still buy. Video proof. Email when a confirmed path is down.',
  },
  install: {
    title: 'Install FixFlags on Shopify',
    description:
      'Install FixFlags on your Shopify store. We walk the path to checkout and alert you if customers cannot buy.',
  },
  pricing: {
    title: 'FixFlags Pricing',
    description:
      'Website monitoring priced per site. One website free, verified weekly. Pro is $49 per website per month, verified every day.',
  },
  requestDemo: {
    title: 'Request a FixFlags demo',
    description:
      'Request a demo for daily website verification, billed per website. We are not charging yet.',
  },
  waitlist: {
    title: 'Join the waitlist',
    description:
      'Pro is $49 per website per month, verified every day. Join the list. We email you when checkout opens. Sign up required.',
  },
  howItWorks: {
    title: 'How FixFlags Works',
    description:
      'Enter a website URL, inspect evidence-backed Flags, verify improvements, and add context only when it makes the next decision clearer.',
  },
  samples: {
    title: 'Sample Report',
    description:
      'See a real FixFlags report of DemoSite: evidence-backed Flags with fix prompts.',
  },
  examples: {
    title: 'Example Reports',
    description:
      'FixFlags Site checks of recognizable sites like web.dev, Vercel, and Wikipedia.',
  },
  faq: {
    title: 'FAQ',
    description:
      'Answers about FixFlags website analysis, Flags, evidence, verification, Site monitoring, and Shopify connections.',
  },
  help: {
    title: 'Help Center',
    description:
      'Guides for website analysis, Flags, verification, Site monitoring, connections, and account support.',
  },
  docs: {
    title: 'FixFlags Documentation',
    description:
      'Learn how FixFlags analyzes a Site, verifies important paths, uses evidence, and progressively adds context.',
  },
  changelog: {
    title: 'Changelog',
    description:
      'Product updates, new checks, and shipping improvements for FixFlags.',
  },
  metaPreview: {
    title: 'Meta Preview Tool – FixFlags',
    description:
      'See how your page looks when shared on Slack, X, LinkedIn, and Discord. Check og:image, title, and description tags on any URL. Free tool.',
  },
  placeholderDetector: {
    title: 'Placeholder Copy Detector – FixFlags',
    description:
      'Scan any URL for Lorem ipsum, TODO markers, AI-builder template artifacts, and unreplaced tokens. Free tool.',
  },
  blog: {
    title: 'Blog',
    description:
      'Notes on shipping AI-built products without the embarrassing bugs: product review, what breaks first, and what to fix before users see it.',
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How FixFlags collects and uses your data.',
  },
  terms: {
    title: 'Terms of Service',
    description: 'Terms for using FixFlags.',
  },
  issues: {
    title: 'Flag Library',
    description:
      'Real Flags from reviewed sites, with frequency, affected frameworks, examples, and fixes.',
  },
  partners: {
    title: 'FixFlags Expert Program',
    description:
      'Studios handing off a live Lovable, Bolt, or MVP site can use FixFlags as the delivery review before the client sees it.',
  },
} as const

/** `/roast` is live but noindex and kept off nav, footer, and INDEXABLE_ROUTES. */
export const ROAST_SEO = {
  title: 'Website Roast - FixFlags',
  description:
    'Check a live page with FixFlags and see what needs attention. Then fix it.',
} as const
