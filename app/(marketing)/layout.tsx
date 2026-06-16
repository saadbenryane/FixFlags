import { BRAND } from '@/lib/marketing/copy'
import { MarketingShell } from '@/components/layout/marketing-shell'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: BRAND.name,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  description: BRAND.oneLiner,
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://fixflags.com',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingShell>{children}</MarketingShell>
    </>
  )
}
