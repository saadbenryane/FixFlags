import { headers } from 'next/headers'
import { marketingGraphSchema } from '@/lib/marketing/structured-data'
import { MarketingShell } from '@/components/layout/marketing-shell'

const jsonLd = marketingGraphSchema()

const SUPPORT_ENABLED_PREFIXES = ['/help', '/faq'] as const

function knowledgeSupportEnabled(pathname: string): boolean {
  return SUPPORT_ENABLED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = (await headers()).get('x-pathname') ?? ''
  const pathOnly = pathname.split('?')[0] ?? ''

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingShell showSupport={knowledgeSupportEnabled(pathOnly)}>{children}</MarketingShell>
    </>
  )
}
