'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Props {
  orderId: string
}

export function ExpertReviewFulfillButton({ orderId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function fulfill() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/expert-reviews/${orderId}/fulfill`, { method: 'POST' })
      if (!res.ok) {
        toast.error('Could not mark order fulfilled')
        return
      }
      toast.success('Order marked fulfilled')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" onClick={fulfill} disabled={loading}>
      Mark fulfilled
    </Button>
  )
}
