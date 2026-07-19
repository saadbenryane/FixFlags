import type { DemoFixture } from '@/lib/demo/types'
import { DEMO_BRAND } from '@/lib/demo/brand'
import { originalFixture } from '@/lib/demo/fixtures/original'

const description =
  'PlantDad helps remote teams keep their office plants alive with AI-powered monitoring and smart watering schedules. Grow more, kill less.'

/** Improved fork from original. Not built on any other variant. */
export const v1Fixture: DemoFixture = {
  ...originalFixture,
  slug: 'v1',
  versionLabel: 'v1',
  path: '/demo/v1',
  metadata: {
    title: `${DEMO_BRAND.name} - Smart plant care for your team`,
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
      title: `${DEMO_BRAND.name} - Smart plant care for your team`,
      description,
      images: [{ url: '/demo/og-v1.png', width: 1200, height: 630, alt: DEMO_BRAND.name }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${DEMO_BRAND.name} - Smart plant care for your team`,
      description,
      images: ['/demo/og-v1.png'],
    },
  },
  announcement: null,
  navLinks: [{ label: 'Features', href: '#features' }],
  headline: 'Grow your plant collection with zero effort',
  subhead:
    'Founders use PlantDad to turn chaotic plant care into automated watering schedules. As seen in TechCrunch. Start your 14-day free trial - no credit card required.',
  primaryCta: { label: 'Start free', href: '/demo/v1/signup' },
  secondaryCta: null,
  heroImageSrc: '/demo/hero-v1.svg',
  heroImageAlt: 'PlantDad dashboard showing plant health and watering schedule',
  featuresSectionTitle: 'Everything you need to keep plants alive',
  features: [
    {
      title: 'AI-powered monitoring',
      description: 'Track plant health in real-time with our advanced soil analysis engine.',
    },
    {
      title: 'One-click watering',
      description: 'Auto-water your plants with a single click. Never kill a succulent again.',
    },
    {
      title: 'Plant analytics built in',
      description: 'Track growth rates, health scores, and survival streaks out of the box.',
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
    statLine: 'Join 10,000+ happy plant parents',
    testimonials: [
      { quote: 'Increased office morale by 30% after switching to PlantDad workflows', author: 'Sarah Chen', role: 'CTO at Acme' },
    ],
  },
  form: {
    heading: 'Adopt your first plant today',
    fields: [
      { name: 'name', type: 'text', label: 'Full name', required: true },
      { name: 'email', type: 'email', label: 'Work email', required: true },
      { name: 'plan', type: 'select', label: 'Plan', options: ['Starter', 'Pro', 'Enterprise'], required: true },
    ],
    submitLabel: 'Adopt a plant',
  },
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: DEMO_BRAND.name,
    description,
    url: 'https://fixflags.com/demo/v1',
  },
}
