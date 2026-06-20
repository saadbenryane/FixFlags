'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

interface Props {
  packId: string
  label: string
  price: string
  popular?: boolean
}

export function CreditPackButton({ packId, label, price, popular }: Props) {
  const router = useRouter()
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
      disabled={loading}
      className="w-full"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      {label} — {price}
    </Button>
  )
}
