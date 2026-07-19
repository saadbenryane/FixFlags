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
  announcement: 'CloudNap 2.0 just dropped. Now with AI-powered dream analysis and optimized nap routes.',
  navLinks: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Blog', href: '#blog' },
    { label: 'Docs', href: '#docs' },
    { label: 'About', href: '#about' },
  ],
  headline: 'Your team deserves better naps than a couch in the break room',
  subhead:
    'CloudNap uses AI to schedule the perfect nap window based on your calendar, energy levels, and meeting load. Sleep smarter, ship faster.',
  primaryCta: { label: 'Start napping', href: '/demo/signup' },
  secondaryCta: { label: 'Watch demo', href: '#demo' },
  heroImageSrc: '/demo/hero-original.svg',
  heroImageAlt: 'CloudNap dashboard showing optimized nap schedule',
  featuresSectionTitle: '',
  features: [
    {
      title: 'Smart nap routing',
      description: 'Lorem ipsum dolor sit amet, our AI finds the optimal nap window between meetings.',
    },
    {
      title: 'One-click hibernate',
      description: 'Auto-respond to Slack and start a power nap with a single click.',
    },
    {
      title: 'Dream analytics',
      description: 'Track sleep quality, dream intensity, and REM cycles out of the box.',
    },
  ],
  footerLinks: [
    { label: 'Partner', href: 'https://example.com' },
    { label: 'Privacy', href: '#privacy' },
    { label: 'Terms', href: '#terms' },
    { label: 'Contact', href: 'mailto:hello@cloudnap-demo.app' },
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
    statLine: 'Trusted by 10,000+ well-rested professionals',
    testimonials: [
      {
        quote: 'CloudNap helped us ship our product after our team finally got some real sleep.',
        author: 'John D.',
        role: 'CEO, Company Name',
      },
    ],
  },
  form: {
    heading: 'Start napping today',
    fields: [
      { name: 'name', type: 'text', label: 'Full name' },
      { name: 'email', type: 'email', label: 'Email address' },
      { name: 'plan', type: 'select', label: 'Plan', options: ['Starter', 'Pro', 'Enterprise'] },
    ],
    submitLabel: 'Start napping',
  },
}
