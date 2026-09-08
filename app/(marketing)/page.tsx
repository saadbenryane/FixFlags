import { CareHomepage } from '@/components/marketing/homepage/CareHomepage'
import { LandingViewTracker } from '@/components/marketing/landing/LandingViewTracker'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('home', '/')
export const revalidate = 3600

export default function HomePage() {
  return (
    <>
      <LandingViewTracker />
      <CareHomepage />
    </>
  )
}
