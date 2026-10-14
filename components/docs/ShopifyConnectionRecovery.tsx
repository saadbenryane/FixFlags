import Link from 'next/link'
import { SITE_CONNECTION_COPY } from '@/lib/marketing/copy/site-connections'
import { SHOPIFY_CONNECTION_RECOVERY, SHOPIFY_GUIDE_RECOVERY as C } from '@/lib/marketing/copy/shopify'

export function ShopifyConnectionRecovery({ error }: { error?: string }) {
  const message = error && Object.hasOwn(SHOPIFY_CONNECTION_RECOVERY, error)
    ? SHOPIFY_CONNECTION_RECOVERY[error as keyof typeof SHOPIFY_CONNECTION_RECOVERY]
    : null
  if (!message) return null
  return <div role="alert" className="mb-8 rounded-card border border-border bg-muted/40 p-5">
    <p className="font-semibold">{C.title}</p>
    <p className="mt-2 text-sm leading-6">{message}</p>
    <Link href="/dashboard" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-link">{C.openSites}</Link>
    <p className="text-sm text-muted-foreground">{SITE_CONNECTION_COPY.comingSoonBody}</p>
  </div>
}
