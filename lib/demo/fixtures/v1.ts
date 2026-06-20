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
  headline: 'Ship a landing page your customers understand in 5 seconds',
  subhead:
    'Founders use LaunchPad to turn a rough idea into a polished, conversion-ready page. No design skills required.',
  primaryCta: { label: 'Start free', href: '#signup' },
  secondaryCta: null,
  heroImageSrc: '/demo/hero-v1.svg',
  footerLinks: [
    { label: 'Privacy', href: '#privacy' },
    { label: 'Terms', href: '#terms' },
    { label: 'Contact', href: '#signup' },
  ],
  layout: {
    compactMobileNav: true,
    ctaAboveFoldMobile: true,
    showAnnouncement: false,
    largeHeroImageMobile: false,
  },
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: DEMO_BRAND.name,
    description,
    url: 'https://fixflags.com/demo/v1',
  },
}
