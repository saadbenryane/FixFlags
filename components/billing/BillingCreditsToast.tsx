'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CREDIT_PACKS } from '@/lib/billing/credits'

export function BillingCreditsToast() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const started = useRef(false)

  useEffect(() => {
    if (searchParams.get('credits') !== '1' || started.current) return
    started.current = true

    const packId = searchParams.get('pack')
    const pack = CREDIT_PACKS.find((p) => p.id === packId)
    toast.success(pack ? `${pack.label} purchased` : 'Credits purchased', {
      description: 'Credits are available as soon as the payment webhook confirms.',
    })

    const next = new URLSearchParams(searchParams.toString())
    next.delete('credits')
    next.delete('pack')
    const qs = next.toString()
    router.replace(qs ? `/billing?${qs}` : '/billing')
  }, [router, searchParams])

  return null
}
