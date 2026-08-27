'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { trackEvent } from '@/lib/analytics/events'
import { SYSTEM_COPY } from '@/lib/marketing/copy'

interface Props {
  label?: string
}

export function ManageSubscriptionButton({ label = 'Manage subscription' }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      if (!res.ok) {
        toast.error((await parseApiErrorResponse(res)).message)
        return
      }
      const data = await res.json()
      if (data.url) {
        trackEvent('managed_subscription')
        window.location.href = data.url
      } else {
        toast.error('The billing portal did not return a destination.')
      }
    } catch {
      toast.error(SYSTEM_COPY.errors.billingPortal)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      loading={loading}
      loadingLabel="Opening billing…"
    >
      {label}
    </Button>
  )
}
