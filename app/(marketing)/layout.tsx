import { marketingGraphSchema } from '@/lib/marketing/structured-data'
import { MarketingShell } from '@/components/layout/marketing-shell'

const jsonLd = marketingGraphSchema()

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
