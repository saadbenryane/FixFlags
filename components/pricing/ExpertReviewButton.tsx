'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

interface Props {
  auditId?: string
  isLoggedIn: boolean
  label: string
}

export function ExpertReviewButton({ auditId, isLoggedIn, label }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!isLoggedIn) {
      router.push('/sign-up')
      return
    }
    if (!auditId) {
      router.push('/dashboard?expert_review=select')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/stripe/expert-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId }),
      })
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res)
        if (res.status === 503) {
          toast.error('Expert Review is not configured yet.')
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
    <Button variant="outline" disabled={loading} onClick={handleClick}>
      {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      {label}
    </Button>
  )
}
