'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { trackEvent } from '@/lib/analytics/events'

interface Props {
  packId: string
  label: string
  price: string
  popular?: boolean
}

export function CreditPackButton({ packId, label, price, popular }: Props) {
  const [loading, setLoading] = useState(false)

  async function handlePurchase() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/credit-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res)
        if (res.status === 503) {
          toast.error('Credit packs are not configured yet.')
        } else {
          toast.error(parsed.message)
        }
        return
      }
      const data = await res.json()
      if (data.url) {
        trackEvent('started_checkout', { plan: packId, is_logged_in: true })
        window.location.href = data.url
      } else {
        toast.error('Checkout did not return a destination.')
      }
    } catch {
      toast.error('Could not start checkout. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={popular ? 'default' : 'outline'}
      onClick={handlePurchase}
      loading={loading}
      loadingLabel="Opening checkout…"
      className="w-full"
    >
      {label} - {price}
    </Button>
  )
}
