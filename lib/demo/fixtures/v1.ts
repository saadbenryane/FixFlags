import type { DemoFixture } from '@/lib/demo/types'
import { DEMO_BRAND } from '@/lib/demo/brand'
import { originalFixture } from '@/lib/demo/fixtures/original'

const description =
  'DemoSite helps product teams run every release as a checklist, with automated pre-flight checks and a clear go or no-go before rollout.'

const title = `${DEMO_BRAND.name} - Release checklists for product teams`

/** Improved fork from original. Not built on any other variant. */
export const v1Fixture: DemoFixture = {
  ...originalFixture,
  slug: 'v1',
  versionLabel: 'v1',
  path: '/demo/v1',
  metadata: {
    title,
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
      title,
      description,
      images: [{ url: '/demo/og-v1.png', width: 1200, height: 630, alt: DEMO_BRAND.name }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/demo/og-v1.png'],
    },
  },
  announcement: null,
  navLinks: [{ label: 'Features', href: '#features' }],
  headline: 'Ship every release without a last-minute scramble',
  subhead:
    'Product teams use DemoSite to turn chaotic releases into a repeatable checklist with automated pre-flight checks. As seen in TechCrunch. Start your 14-day free trial - no credit card required.',
  primaryCta: { label: 'Start free', href: '/demo/v1/signup' },
  secondaryCta: null,
  heroImageSrc: '/demo/hero-v1.svg',
  heroImageAlt: 'DemoSite dashboard showing release checklist and pre-flight status',
  featuresSectionTitle: 'Everything you need to run a calm release',
  features: [
    {
      title: 'Automated pre-flight checks',
      description: 'Verify build, migration, and rollout readiness before anything reaches users.',
    },
    {
      title: 'One-click rollout',
      description: 'Roll out to production with a single click, and roll back just as fast.',
    },
    {
      title: 'Launch analytics built in',
      description: 'Track release frequency, failure rates, and recovery time out of the box.',
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
    statLine: 'Join 10,000+ teams shipping on schedule',
    testimonials: [
      {
        quote: 'Cut our failed releases by 30% in the first quarter on DemoSite',
        author: 'Sarah Chen',
        role: 'CTO at Acme',
      },
    ],
  },
  form: {
    heading: 'Start your first launch today',
    fields: [
      { name: 'name', type: 'text', label: 'Full name', required: true },
      { name: 'email', type: 'email', label: 'Work email', required: true },
      { name: 'plan', type: 'select', label: 'Plan', options: ['Starter', 'Pro', 'Enterprise'], required: true },
    ],
    submitLabel: 'Start a launch',
  },
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: DEMO_BRAND.name,
    description,
    url: 'https://fixflags.com/demo/v1',
  },
}
