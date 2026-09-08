'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { shopifyInstallCtaHref } from '@/lib/shopify/config'
import { SHOPIFY_APP } from '@/lib/marketing/copy/shopify'
import { trackEvent } from '@/lib/analytics/events'

export function ShopifyInstallCta({
  idSuffix = '',
  compact = false,
}: {
  idSuffix?: string
  compact?: boolean
}) {
  const listingHref = shopifyInstallCtaHref()
  const [shop, setShop] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (listingHref !== '/install') {
    return (
      <Button variant="brand" size="lg" asChild className="min-h-12 px-6 font-semibold">
        <a
          href={listingHref}
          onClick={() => trackEvent('shopify_install_started')}
        >
          {compact ? SHOPIFY_APP.compactInstallCta : SHOPIFY_APP.installCta}
          <ArrowRight />
        </a>
      </Button>
    )
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = shop.trim()
    if (!value) {
      setError('Enter your store, like your-store.myshopify.com')
      return
    }
    setError(null)
    trackEvent('shopify_install_started')
    window.location.assign(`/api/shopify/auth?shop=${encodeURIComponent(value)}`)
  }

  return (
    <form onSubmit={submit} className="w-full space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={`shop-domain${idSuffix}`}
          name="shop"
          value={shop}
          onChange={(event) => setShop(event.target.value)}
          placeholder={SHOPIFY_APP.shopPlaceholder}
          aria-label={SHOPIFY_APP.shopLabel}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-12"
        />
        <Button type="submit" variant="brand" size="lg" className="min-h-12 shrink-0 px-6 font-semibold">
          {compact ? SHOPIFY_APP.compactInstallCta : SHOPIFY_APP.continueCta}
          <ArrowRight />
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  )
}
