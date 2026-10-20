import { GUIDES_PAGE } from './guides'
import { WEBSITE_PROMISE } from './care-homepage'
import { PUBLIC_OFFER } from './public-offer'

export const SEO = {
  guides: { title: GUIDES_PAGE.metadataTitle, description: GUIDES_PAGE.description },
  coverage: {
    title: 'What FixFlags checks | FixFlags',
    description: 'Explore website checks across eight areas, their setup requirements, and what the evidence can establish.',
  },
  security: {
    title: 'Privacy and security | FixFlags',
    description: 'Understand what FixFlags records, who can access evidence, how AI is used, and how to control connections and deletion.',
  },
  useCases: {
    title: 'Website monitoring use cases | FixFlags',
    description: 'See how founders, ecommerce operators, agencies, and growth teams can check live websites and act on evidence.',
  },
  home: {
    title: 'FixFlags - Your software runs. FixFlags watches.',
    description:
      WEBSITE_PROMISE,
  },
  integrations: {
    title: 'FixFlags Integrations',
    description:
      'Connect GitHub to FixFlags. Explore other integrations coming soon after testing and validation.',
  },
  pricing: {
    title: 'FixFlags Pricing',
    description: [PUBLIC_OFFER.free, PUBLIC_OFFER.availability].join(' '),
  },
  requestDemo: {
    title: 'Request a FixFlags demo',
    description:
      'Request a walkthrough of the checks, evidence, and next steps for the website you look after.',
  },
  waitlist: {
    title: 'Join the waitlist',
    description: [PUBLIC_OFFER.paid, PUBLIC_OFFER.availability].join(' '),
  },
  howItWorks: {
    title: 'How FixFlags Works',
    description:
      'Monitor. Flag. Fix. Repeat. Start with your website URL, see what needs attention, publish a fix, and check the same live behavior again.',
  },
  samples: {
    title: 'Sample Site and Flag',
    description:
      'Explore a recorded demo check, its page capture, a fix prompt, and the evidence a fresh verification needs.',
  },
  faq: {
    title: 'FAQ',
    description:
      'Answers about FixFlags website analysis, Flags, evidence, verification, Site monitoring, GitHub authorization, and planned integrations.',
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
    title: 'FixFlags Blog',
    description:
      'Practical guides to website launch checks, independent verification, and monitoring the customer actions that matter.',
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

} as const

/** `/roast` is live but noindex and kept off nav, footer, and INDEXABLE_ROUTES. */
export const ROAST_SEO = {
  title: 'Website Roast - FixFlags',
  description:
    'Check a live page with FixFlags and see what needs attention. Then fix it.',
} as const
