'use client'

import { useCallback, useEffect, useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ShopifyWorkspace as Workspace } from '@/lib/shopify/workspace'
import { ShopifyWorkspace, shopifyRequest } from './ShopifyWorkspace'

export function ShopifyAppLoader({
  fixtureToken,
}: {
  fixtureToken: string | null
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setError(null)
    try {
      await shopifyRequest('/api/shopify/session', fixtureToken, { method: 'POST' })
      const response = await shopifyRequest('/api/shopify/status', fixtureToken)
      if (response.status === 401) throw new Error('Your Shopify session expired. Reload the app from Shopify admin.')
      if (response.status === 404) throw new Error('This store is not connected yet. Reinstall FixFlags from Shopify admin.')
      if (!response.ok) throw new Error('FixFlags could not load this store. Try again.')
      setWorkspace(await response.json() as Workspace)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'FixFlags could not load this store.')
    } finally {
      setLoading(false)
    }
  }, [fixtureToken])

  useEffect(() => {
    void load()
  }, [load])

  if (workspace) {
    return <ShopifyWorkspace workspace={workspace} fixtureToken={fixtureToken} onRefresh={load} />
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4 py-12">
      <Card className="w-full space-y-4 p-6" aria-live="polite">
        <Logo variant="lockup" size="sm" />
        <h1 className="text-xl font-semibold">{loading ? 'Connecting your store…' : 'Store connection needs attention'}</h1>
        <p className="text-sm text-muted-foreground">
          {loading ? 'Confirming the signed Shopify session before loading store data.' : error}
        </p>
        {!loading ? <Button onClick={() => { setLoading(true); void load() }}>Try again</Button> : null}
      </Card>
    </main>
  )
}
