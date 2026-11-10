import { preload } from 'react-dom'
import { CareHomepage } from '@/components/marketing/homepage/CareHomepage'
import { HERO_STUDIO_IMAGE } from '@/components/marketing/homepage/hero-assets'
import { LandingViewTracker } from '@/components/marketing/landing/LandingViewTracker'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('home', '/')
export const revalidate = 3600

// The hero studio image is the homepage's largest paint. It is a CSS background, so
// without a hint the browser only finds it after the stylesheet arrives. Light is the
// default theme; dark visitors fetch their variant through the stylesheet as before.

export default function HomePage() {
  preload(HERO_STUDIO_IMAGE, { as: 'image', fetchPriority: 'high' })
  return (
    <>
      <LandingViewTracker />
      <CareHomepage />
    </>
  )
}
