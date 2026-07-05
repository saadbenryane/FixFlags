'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { PRICING } from '@/lib/marketing/copy'
import { toast } from 'sonner'

export type ExpertReviewAuditOption = {
  id: string
  url: string
  score: number | null
  createdAt: string | Date
}

interface ExpertReviewSelectDialogProps {
  audits: ExpertReviewAuditOption[]
}

export function ExpertReviewSelectDialog({ audits }: ExpertReviewSelectDialogProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    setOpen(searchParams.get('expert_review') === 'select')
  }, [searchParams])

  function clearParam() {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('expert_review')
    const qs = next.toString()
    router.replace(qs ? `/dashboard?${qs}` : '/dashboard')
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) clearParam()
  }

  async function startCheckout(auditId: string) {
    setLoadingId(auditId)
    try {
      const res = await fetch('/api/stripe/expert-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      toast.error(data.message || 'Failed to start checkout')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{PRICING.expertReview.title}</DialogTitle>
          <DialogDescription>{PRICING.expertReview.body}</DialogDescription>
        </DialogHeader>

        {audits.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              title="Run a check first"
              description="Expert Review needs a completed audit. Paste a URL below, then return here from Pricing."
            />
            <AuditInput idSuffix="-expert-review-dialog" />
            <Button variant="outline" asChild className="w-full">
              <Link href="/pricing">Back to pricing</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Pick the report you want reviewed.</p>
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {audits.map((audit) => (
                <li key={audit.id}>
                  <Card className="border-0 shadow-card">
                    <CardContent className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{audit.url}</p>
                        <p className="text-xs text-muted-foreground">
                          Score {audit.score ?? '–'} ·{' '}
                          {new Date(audit.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={loadingId !== null}
                        onClick={() => startCheckout(audit.id)}
                      >
                        {loadingId === audit.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          PRICING.expertReview.cta
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
