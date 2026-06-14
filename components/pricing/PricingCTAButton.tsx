'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

interface Props {
  plan: 'FREE' | 'BUILDER' | 'TEAM' | 'STUDIO'
  cta: string
  signUpHref: string
  highlight?: boolean
  isLoggedIn: boolean
  currentPlan: string
}

export function PricingCTAButton({ plan, cta, signUpHref, highlight, isLoggedIn, currentPlan }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const isCurrent = isLoggedIn && currentPlan === plan

  async function handleClick() {
    if (!isLoggedIn) {
      router.push(signUpHref)
      return
    }

    if (plan === 'FREE') {
      router.push('/dashboard')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, useFounding: true }),
      })
      if (!res.ok) {
        toast.error((await parseApiErrorResponse(res)).message)
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
      className="w-full"
      variant={highlight ? 'default' : 'outline'}
      disabled={loading || isCurrent}
      onClick={handleClick}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      {isCurrent ? 'Current plan' : cta}
    </Button>
  )
}
