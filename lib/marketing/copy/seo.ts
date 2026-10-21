import { GUIDES_PAGE } from './guides'
import { WEBSITE_PROMISE } from './care-homepage'
import { PUBLIC_OFFER } from './public-offer'

export const SEO = {
  guides: { title: GUIDES_PAGE.metadataTitle, description: GUIDES_PAGE.description },
  coverage: {
    title: 'What FixFlags checks | FixFlags',
    description: 'See what FixFlags checks, from broken pages to slow loading. Explore the checks, setup, and limits across eight website areas.',
  },
  security: {
    title: 'Privacy and security | FixFlags',
    description: 'Understand what FixFlags records, who can access evidence, how AI is used, and how to control connections and deletion.',
  },
  useCases: {
    title: 'Website monitoring use cases | FixFlags',
    description: 'Website checks, email alerts, and fix guidance for builders, store owners, agencies, and marketing teams.',
  },
  home: {
    title: 'FixFlags | Website monitoring. From problem to fix.',
    description:
      WEBSITE_PROMISE,
  },
  integrations: {
    title: 'FixFlags Integrations',
    description:
      'Start with your website URL. Explore GitHub account connection and other integrations coming soon.',
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
      'Enter your URL, see what needs attention, and get help fixing it. Save your website for fix prompts, scheduled checks, and email alerts.',
  },
  samples: {
    title: 'Sample Site and Flag',
    description:
      'Try a recorded demo check. See a website problem, read the evidence, and copy a fix prompt for your AI.',
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
      'Learn how to check your website, read a Flag, use a fix prompt, and set up monitoring.',
  },
  changelog: {
    title: 'Changelog',
    description:
      'Product updates, new checks, and shipping improvements for FixFlags.',
  },
  metaPreview: {
    title: 'Link preview checker | FixFlags',
    description:
      'Check the image, title, and description people see when you share a page. Free link preview tool from FixFlags.',
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
      'Reviewed website problems and fix guidance. Published patterns include their evidence, research scope, and limits.',
  },

} as const

/** `/roast` is live but noindex and kept off nav, footer, and INDEXABLE_ROUTES. */
export const ROAST_SEO = {
  title: 'Website Roast - FixFlags',
  description:
    'Check a live page with FixFlags and see what needs attention. Then fix it.',
} as const
