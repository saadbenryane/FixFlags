/**
 * Demo fixture regression baseline. DO NOT edit in place for improvements.
 *
 * Autonomous improvement loop:
 * 1. Audit baseline: tsx scripts/demo-fixture-audit.ts [baseUrl]  (/demo = this fixture)
 * 2. Copy original.ts to vN.ts, apply FixFlags expert prompts as a developer would
 * 3. Re-audit /demo/vN until flag count hits zero (or only acceptable site-level noise)
 * 4. Upgrade flag copy in lib/audit/flag-copy.ts when prompts are weak
 *
 * Fixed fork: /demo/v1 (v1Fixture)
 */
import type { DemoFixture } from '@/lib/demo/types'
import { DEMO_BRAND } from '@/lib/demo/brand'

export const originalFixture: DemoFixture = {
  slug: '',
  versionLabel: 'original',
  path: '/demo',
  metadata: {
    title: DEMO_BRAND.name,
    description: '',
    robots: { index: false, follow: false },
    openGraph: {
      title: DEMO_BRAND.name,
      type: 'website',
      images: [],
    },
    twitter: {
      card: 'summary',
      images: [],
    },
  },
  announcement:
    'Launchpad 2.0 just dropped. Now with AI-generated release notes and automated pre-flight checks.',
  navLinks: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Blog', href: '#blog' },
    { label: 'Docs', href: '#docs' },
    { label: 'About', href: '#about' },
  ],
  headline: 'The launch platform for teams who move fast',
  subhead:
    'Launchpad turns your release into a checklist, watches every pre-flight check, and tells you when something is not ready. Ship more, break less.',
  primaryCta: { label: 'Start a launch', href: '/demo/signup' },
  secondaryCta: { label: 'Watch demo', href: '#demo' },
  heroImageSrc: '/demo/hero-original.svg',
  heroImageAlt: 'Launchpad dashboard showing release checklist and pre-flight status',
  featuresSectionTitle: '',
  features: [
    {
      title: 'Pre-flight checks',
      description:
        'Lorem ipsum dolor sit amet, our AI runs your release checks and reports status in real time.',
    },
    {
      title: 'One-click rollout',
      description: 'Roll out to production with a single click. Never ship a broken build again.',
    },
    {
      title: 'Launch analytics',
      description: 'Track release frequency, failure rates, and recovery time out of the box.',
    },
  ],
  footerLinks: [
    { label: 'Partner', href: 'https://example.com' },
    { label: 'Privacy', href: '#privacy' },
    { label: 'Terms', href: '#terms' },
    { label: 'Contact', href: `mailto:${DEMO_BRAND.contactEmail}` },
  ],
  layout: {
    compactMobileNav: false,
    ctaAboveFoldMobile: false,
    showAnnouncement: true,
    largeHeroImageMobile: true,
    slowSignupDestination: true,
    brokenScrollReveal: true,
    simulateSlowBundle: true,
  },
  signupDestination: {
    slowReveal: true,
    missingTrust: true,
    slowValidation: true,
    smallInputFont: true,
  },
  socialProof: {
    statLine: 'Trusted by 10,000+ teams who stopped shipping broken releases',
    testimonials: [
      {
        quote: 'Launchpad kept our releases on schedule through three consecutive rewrites.',
        author: 'Jane D.',
        role: 'Engineering Manager, Startup Co.',
      },
    ],
  },
  form: {
    heading: 'Start your first launch today',
    fields: [
      { name: 'name', type: 'text', label: 'Full name' },
      { name: 'email', type: 'email', label: 'Email address' },
      { name: 'plan', type: 'select', label: 'Plan', options: ['Starter', 'Pro', 'Enterprise'] },
    ],
    submitLabel: 'Start a launch',
  },
}
