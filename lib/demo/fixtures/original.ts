/**
 * Demo fixture regression baseline. DO NOT edit in place for improvements.
 *
 * Workflow:
 * 1. Pipeline regression: audit https://fixflags.com/demo (this fixture).
 * 2. Fix validation: audit https://fixflags.com/demo/v1 (fork from original).
 * 3. New variant: copy original.ts → v1.2.ts, apply fixes, add route. Never chain variants.
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
}
