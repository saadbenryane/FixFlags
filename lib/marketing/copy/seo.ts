import { PRICING_COPY } from './terminology'

export const SEO = {
  home: {
    title: 'FixFlags - Catch what your AI missed before launch',
    description:
      'Your AI says it\u2019s done. Paste a URL and FixFlags runs Product QA for Message, Experience, and Reach Flags. Fix prompts for Cursor, Claude, Lovable, Bolt, and Devin. Free product review.',
  },
  pricing: {
    title: 'Pricing',
    description:
      `Start free with ${PRICING_COPY.freeProductReviewsLifetime} product reviews (lifetime) and ${PRICING_COPY.freeDeepReviewTeaserLifetime} deep review teaser (lifetime). Pro adds ${PRICING_COPY.proProductReviewsPerMonth} product reviews, ${PRICING_COPY.proDeepReviewsPerMonth} deep reviews, and before/after compare.`,
  },
  waitlist: {
    title: 'Join the waitlist',
    description:
      'Pro and Studio open in order. The first 500 waitlisters per plan get 25% off for 12 months from launch. The next 500 get 15% off. Sign up required.',
  },
  howItWorks: {
    title: 'How FixFlags Works',
    description:
      'Paste a live URL and get a complete Product Review across Message, Experience, and Reach with evidence-backed fix prompts.',
  },
  samples: {
    title: 'Sample Report',
    description:
      'See a real FixFlags report of our Launchpad demo landing page: evidence-backed Flags with fix prompts.',
  },
  examples: {
    title: 'Example Reports',
    description:
      'Automated FixFlags product reviews of recognizable sites like web.dev, Vercel, and Wikipedia.',
  },
  faq: {
    title: 'FAQ',
    description:
      'Answers about FixFlags Product Reviews, Flags, fix prompts, free vs paid plans, and who it\u2019s for.',
  },
  help: {
    title: 'Help Center',
    description:
      'Guides for FixFlags Product Reviews, reports, billing, and your account. Chat with us when you need a human.',
  },
  docs: {
    title: 'FixFlags Documentation',
    description:
      'Learn FixFlags Product Reviews, Fix lists, reports, and update reviews.',
  },
  changelog: {
    title: 'Changelog',
    description: 'Product updates, new checks, and shipping improvements for FixFlags.',
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
    description: 'Notes on shipping AI-built products without the embarrassing bugs: product review, what breaks first, and what to fix before users see it.',
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
    description: 'Real Flags from reviewed sites, with frequency, affected frameworks, examples, and fixes.',
  },
  partners: {
    title: 'Expert program',
    description:
      'FixFlags delivery reviews for Lovable, Bolt, and MVP studios. Catch Flags before client handoff.',
  },
  roast: {
    title: 'Website Roast – FixFlags',
    description:
      'Get a blunt quality check across Message, Experience, and Reach. Paste a URL, get a grade, then fix what matters.',
  },
} as const
