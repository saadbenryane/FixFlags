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
  announcement: 'PlantDad 2.0 just dropped. Now with AI-powered soil analysis and personalized watering schedules.',
  navLinks: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Blog', href: '#blog' },
    { label: 'Docs', href: '#docs' },
    { label: 'About', href: '#about' },
  ],
  headline: 'Your desk deserves a plant that does not give up on you',
  subhead:
    'PlantDad uses AI to monitor your plants, schedule watering, and send passive-aggressive reminders when you forget. Grow more, kill less.',
  primaryCta: { label: 'Adopt a plant', href: '/demo/signup' },
  secondaryCta: { label: 'Watch demo', href: '#demo' },
  heroImageSrc: '/demo/hero-original.svg',
  heroImageAlt: 'PlantDad dashboard showing plant health and watering schedule',
  featuresSectionTitle: '',
  features: [
    {
      title: 'Smart soil sensors',
      description: 'Lorem ipsum dolor sit amet, our AI tracks moisture, light, and nutrient levels in real time.',
    },
    {
      title: 'One-click watering',
      description: 'Auto-water your plants with a single click. Never kill a succulent again.',
    },
    {
      title: 'Plant analytics',
      description: 'Track growth rates, health scores, and survival streaks out of the box.',
    },
  ],
  footerLinks: [
    { label: 'Partner', href: 'https://example.com' },
    { label: 'Privacy', href: '#privacy' },
    { label: 'Terms', href: '#terms' },
    { label: 'Contact', href: 'mailto:hello@plantdad-demo.app' },
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
    statLine: 'Trusted by 10,000+ plant parents who stopped killing their greenery',
    testimonials: [
      {
        quote: 'PlantDad helped us keep our office plants alive through three consecutive founders.',
        author: 'Jane D.',
        role: 'Office Manager, Startup Co.',
      },
    ],
  },
  form: {
    heading: 'Adopt your first plant today',
    fields: [
      { name: 'name', type: 'text', label: 'Full name' },
      { name: 'email', type: 'email', label: 'Email address' },
      { name: 'plan', type: 'select', label: 'Plan', options: ['Starter', 'Pro', 'Enterprise'] },
    ],
    submitLabel: 'Adopt a plant',
  },
}
