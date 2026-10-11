import Link from 'next/link'
import { SHOPIFY_CONNECTION_RECOVERY } from '@/lib/marketing/copy/shopify'

export function ShopifyConnectionRecovery({ error }: { error?: string }) {
  const message = error && Object.hasOwn(SHOPIFY_CONNECTION_RECOVERY, error)
    ? SHOPIFY_CONNECTION_RECOVERY[error as keyof typeof SHOPIFY_CONNECTION_RECOVERY]
    : null
  if (!message) return null
  return <div role="alert" className="mb-8 rounded-xl border border-border bg-muted/40 p-5">
    <p className="font-semibold">Shopify connection did not finish</p>
    <p className="mt-2 text-sm leading-6">{message}</p>
    <Link href="/dashboard" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-link">Open your Sites</Link>
    <p className="text-sm text-muted-foreground">Select your Site, then open Settings → Connections to try again.</p>
  </div>
}
