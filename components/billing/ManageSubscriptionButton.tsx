'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

export function ManageSubscriptionButton() {
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
        window.location.href = data.url
      } else {
        toast.error('The billing portal did not return a destination.')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={loading}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Manage subscription
    </Button>
  )
}
