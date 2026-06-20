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
}
