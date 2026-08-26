import { MarketingShell } from '@/components/layout/marketing-shell'
import { marketingGraphSchema } from '@/lib/marketing/structured-data'

export default function PublicDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(marketingGraphSchema()) }}
      />
      <MarketingShell footer="minimal" showSupport>
        {children}
      </MarketingShell>
    </>
  )
}
