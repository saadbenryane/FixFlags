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
  announcement: '🚀 LaunchPad 2.0 is here. Now with more AI templates than ever before!',
  navLinks: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Blog', href: '#blog' },
    { label: 'Docs', href: '#docs' },
    { label: 'About', href: '#about' },
  ],
  headline: 'Build something amazing with AI',
  subhead:
    'LaunchPad is the next-generation AI landing page builder for modern teams who want to ship faster.',
  primaryCta: { label: 'Get started', href: '#signup' },
  secondaryCta: { label: 'Watch demo', href: '#demo' },
  heroImageSrc: '/demo/hero-original.svg',
  heroImageAlt: 'Product dashboard preview',
  featuresSectionTitle: 'Everything you need to launch',
  features: [
    {
      title: 'AI-powered design',
      description: 'Generate beautiful layouts in seconds with our advanced AI engine.',
    },
    {
      title: 'One-click deploy',
      description: 'Ship your landing page to production with a single click.',
    },
    {
      title: 'Analytics built in',
      description: 'Track visitors, conversions, and engagement out of the box.',
    },
  ],
  footerLinks: [
    { label: 'Privacy', href: '#privacy' },
    { label: 'Terms', href: '#terms' },
    { label: 'Contact', href: 'mailto:hello@launchpad-demo.app' },
  ],
  layout: {
    compactMobileNav: false,
    ctaAboveFoldMobile: false,
    showAnnouncement: true,
    largeHeroImageMobile: true,
  },
  socialProof: {
    statLine: 'Trusted by 10,000+ happy customers',
    testimonials: [
      {
        quote: 'LaunchPad helped us ship our landing page in a day.',
        author: 'John D.',
        role: 'CEO, Company Name',
      },
    ],
  },
}
