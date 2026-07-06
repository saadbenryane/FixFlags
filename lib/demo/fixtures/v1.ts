import type { DemoFixture } from '@/lib/demo/types'
import { DEMO_BRAND } from '@/lib/demo/brand'
import { originalFixture } from '@/lib/demo/fixtures/original'

const description =
  'LaunchPad helps founders ship conversion-ready landing pages in minutes. Paste your idea, get a polished page, and share it today.'

/** Improved fork from original. Not built on any other variant. */
export const v1Fixture: DemoFixture = {
  ...originalFixture,
  slug: 'v1',
  versionLabel: 'v1',
  path: '/demo/v1',
  metadata: {
    title: `${DEMO_BRAND.name} - Ship landing pages in minutes`,
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
      title: `${DEMO_BRAND.name} - Ship landing pages in minutes`,
      description,
      images: [{ url: '/demo/og-v1.png', width: 1200, height: 630, alt: DEMO_BRAND.name }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${DEMO_BRAND.name} - Ship landing pages in minutes`,
      description,
      images: ['/demo/og-v1.png'],
    },
  },
  announcement: null,
  navLinks: [{ label: 'Features', href: '#features' }],
  headline: 'Ship landing pages for teams in 5 seconds',
  subhead:
    'Founders use LaunchPad to turn a rough idea into a polished, conversion-ready page. As seen in TechCrunch. Start your 14-day free trial - no credit card required.',
  primaryCta: { label: 'Start free', href: '/demo/v1/signup' },
  secondaryCta: null,
  heroImageSrc: '/demo/hero-v1.svg',
  heroImageAlt: 'LaunchPad dashboard showing landing page builder interface',
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
    statLine: 'Join 10,000+ teams',
    testimonials: [
      { quote: 'Increased revenue by 30%', author: 'Sarah Chen', role: 'CTO at Acme' },
    ],
  },
  form: {
    heading: 'Get started today',
    fields: [
      { name: 'name', type: 'text', label: 'Full name', required: true },
      { name: 'email', type: 'email', label: 'Work email', required: true },
      { name: 'plan', type: 'select', label: 'Plan', options: ['Starter', 'Pro', 'Enterprise'], required: true },
    ],
    submitLabel: 'Start free',
  },
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: DEMO_BRAND.name,
    description,
    url: 'https://fixflags.com/demo/v1',
  },
}
