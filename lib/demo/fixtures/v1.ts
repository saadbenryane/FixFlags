import type { DemoFixture } from '@/lib/demo/types'
import { DEMO_BRAND } from '@/lib/demo/brand'
import { originalFixture } from '@/lib/demo/fixtures/original'

const description =
  'CloudNap helps remote teams schedule perfect naps based on their calendar and energy levels. Better sleep, faster shipping.'

/** Improved fork from original. Not built on any other variant. */
export const v1Fixture: DemoFixture = {
  ...originalFixture,
  slug: 'v1',
  versionLabel: 'v1',
  path: '/demo/v1',
  metadata: {
    title: `${DEMO_BRAND.name} - Schedule smarter naps for your team`,
    description,
    robots: { index: true, follow: true },
    icons: {
      icon: '/favicon.ico',
      apple: '/favicon.ico',
    },
    alternates: {
      canonical: 'https://fixflags.com/demo/v1',
    },
    openGraph: {
      title: `${DEMO_BRAND.name} - Schedule smarter naps for your team`,
      description,
      images: [{ url: '/demo/og-v1.png', width: 1200, height: 630, alt: DEMO_BRAND.name }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${DEMO_BRAND.name} - Schedule smarter naps for your team`,
      description,
      images: ['/demo/og-v1.png'],
    },
  },
  announcement: null,
  navLinks: [{ label: 'Features', href: '#features' }],
  headline: 'Schedule smarter naps for your team in 5 seconds',
  subhead:
    'Founders use CloudNap to turn chaotic calendars into optimized nap windows. As seen in TechCrunch. Start your 14-day free trial - no credit card required.',
  primaryCta: { label: 'Start free', href: '/demo/v1/signup' },
  secondaryCta: null,
  heroImageSrc: '/demo/hero-v1.svg',
  heroImageAlt: 'CloudNap dashboard showing nap schedule interface',
  featuresSectionTitle: 'Everything you need to nap better',
  features: [
    {
      title: 'AI-powered scheduling',
      description: 'Generate optimal nap windows in seconds with our advanced AI engine.',
    },
    {
      title: 'One-click hibernate',
      description: 'Auto-respond to messages and start a power nap with a single click.',
    },
    {
      title: 'Dream analytics built in',
      description: 'Track sleep quality, dream intensity, and REM cycles out of the box.',
    },
  ],
  footerLinks: [
    { label: 'Privacy', href: '/demo/v1/privacy' },
    { label: 'Terms', href: '/demo/v1/terms' },
    { label: 'Contact', href: '#signup' },
  ],
  layout: {
    compactMobileNav: true,
    ctaAboveFoldMobile: true,
    showAnnouncement: false,
    largeHeroImageMobile: false,
    slowSignupDestination: false,
    brokenScrollReveal: false,
    simulateSlowBundle: false,
  },
  signupDestination: {
    slowReveal: false,
    missingTrust: false,
  },
  showCookieConsent: true,
  socialProof: {
    statLine: 'Join 10,000+ well-rested teams',
    testimonials: [
      { quote: 'Increased revenue by 30% after switching to nap-first workflows', author: 'Sarah Chen', role: 'CTO at Acme' },
    ],
  },
  form: {
    heading: 'Start napping today',
    fields: [
      { name: 'name', type: 'text', label: 'Full name', required: true },
      { name: 'email', type: 'email', label: 'Work email', required: true },
      { name: 'plan', type: 'select', label: 'Plan', options: ['Starter', 'Pro', 'Enterprise'], required: true },
    ],
    submitLabel: 'Start napping',
  },
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: DEMO_BRAND.name,
    description,
    url: 'https://fixflags.com/demo/v1',
  },
}
