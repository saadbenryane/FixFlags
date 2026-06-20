import type { Metadata } from 'next'

export type DemoFixtureSlug = '' | 'v1'

export interface DemoFeature {
  title: string
  description: string
}

export interface DemoFixture {
  slug: DemoFixtureSlug
  versionLabel: string
  path: string
  metadata: Metadata
  /** Optional JSON-LD object rendered in page for structured-data checks */
  jsonLd?: Record<string, unknown>
  announcement: string | null
  navLinks: { label: string; href: string }[]
  headline: string
  subhead: string
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string } | null
  heroImageSrc: string
  heroImageAlt: string
  featuresSectionTitle: string
  features: DemoFeature[]
  footerLinks: { label: string; href: string }[]
  /** Layout flags for intentional flaws vs fixes */
  layout: {
    compactMobileNav: boolean
    ctaAboveFoldMobile: boolean
    showAnnouncement: boolean
    largeHeroImageMobile: boolean
  }
  /** Minimal GDPR-style banner when site analytics load (v1 fixed fork) */
  showCookieConsent?: boolean
  /** Intentional social-proof flaws on baseline fixture */
  socialProof?: {
    statLine?: string
    testimonials: { quote: string; author: string; role?: string }[]
  } | null
  /** Signup form rendered in #signup section; baseline has no validation, v1 adds required attrs. */
  form?: {
    heading: string
    fields: Array<{
      name: string
      type: 'text' | 'email' | 'select'
      label: string
      options?: string[]
      required?: boolean
    }>
    submitLabel: string
  }
}
