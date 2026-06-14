'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.message || 'Failed to start checkout')
      }
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
