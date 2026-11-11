import { PricingPage } from '@/components/pricing/PricingPage'
import { PRICING } from '@/lib/marketing/copy-barrel'
import { PRICING_PAGE_FAQ } from '@/lib/marketing/copy/pricing-page'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { faqPageSchema } from '@/lib/marketing/structured-data'

export const metadata = buildPageMetadata('pricing', '/pricing')

const pricingFaqJsonLd = faqPageSchema(PRICING_PAGE_FAQ, {
  path: '/pricing',
  name: PRICING.faqTitle,
})

export default function PricingRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingFaqJsonLd) }}
      />
      <PricingPage />
    </>
  )
}
