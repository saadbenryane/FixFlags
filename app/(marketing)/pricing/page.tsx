import { PricingPage } from '@/components/pricing/PricingPage'
import { PRICING, PRICING_FAQ } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { faqPageSchema } from '@/lib/marketing/structured-data'

export const metadata = buildPageMetadata('pricing', '/pricing')

const pricingFaqJsonLd = faqPageSchema(PRICING_FAQ, {
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
