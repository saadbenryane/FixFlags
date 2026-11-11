import { GUIDES_PAGE } from './guides'
import { PUBLIC_OFFER } from './public-offer'
import { PRODUCT_STORY } from './product-story'
import { AI_BUILDERS_PAGE } from './ai-builders'
import { AI_CONNECTION_COPY } from './ai-connection'
import { COMPARE_PAGE } from './compare'
import { FREE_TOOLS_PAGE } from './free-tools'
import { AGENCIES_PAGE } from './agencies'

export const SEO = {
  compare: { title: COMPARE_PAGE.seo.title, description: COMPARE_PAGE.seo.description },
  freeTools: { title: FREE_TOOLS_PAGE.seo.title, description: FREE_TOOLS_PAGE.seo.description },
  agencies: { title: AGENCIES_PAGE.seo.title, description: AGENCIES_PAGE.seo.description },
  connectAi: { title: AI_CONNECTION_COPY.metadataTitle, description: AI_CONNECTION_COPY.description },
  guides: { title: GUIDES_PAGE.metadataTitle, description: GUIDES_PAGE.description },
  coverage: {
    title: 'What FixFlags checks | FixFlags',
    description: 'Broken pages, slow loading, buttons that go nowhere, and more. See what FixFlags checks and what needs a closer look.',
  },
  security: {
    title: 'Privacy and security | FixFlags',
    description: 'Understand what FixFlags records, who can access evidence, how AI is used, and how to control connections and deletion.',
  },
  aiBuilders: {
    title: AI_BUILDERS_PAGE.seo.title,
    description: AI_BUILDERS_PAGE.seo.description,
  },
  home: {
    title: `FixFlags | ${PRODUCT_STORY.headline.join(" ")}`,
    description: PRODUCT_STORY.description,
  },
  pricing: {
    title: 'FixFlags Pricing',
    description: [PUBLIC_OFFER.free, PUBLIC_OFFER.availability].join(' '),
  },
  waitlist: {
    title: 'Join the waitlist',
    description: [PUBLIC_OFFER.paid, PUBLIC_OFFER.availability].join(' '),
  },
  howItWorks: {
    title: 'FixFlags product | How checks, Flags, fixes and verification work',
    description:
      'See how FixFlags checks your live website in a real browser, hands your AI the fix instructions, and rechecks the same page to prove the fix worked. Try the interactive sample.',
  },
  help: {
    title: 'Help Center',
    description:
      'Help with your first website check, fixing problems, scheduled checks, and your account.',
  },
  docs: {
    title: 'FixFlags Documentation',
    description:
      'Learn how to check your website, copy and paste fix instructions, and get email alerts when something needs attention.',
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
  brokenLinks: {
    title: 'Free broken link checker | FixFlags',
    description: 'Paste a URL to find links on the page that return errors or don’t respond. Free, no signup. Then run a full check of your website.',
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
