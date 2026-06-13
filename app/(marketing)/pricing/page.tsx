import { PricingPageClient } from '@/components/pricing/PricingPageClient'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('pricing', '/pricing')

export default function PricingPage() {
  return <PricingPageClient />
}
