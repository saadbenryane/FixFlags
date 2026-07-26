'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SYSTEM_COPY } from '@/lib/marketing/copy'

export function RetryAuditButton({ auditId }: { auditId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/audits/${auditId}/retry`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.message || 'Could not retry the audit')
        return
      }
      toast.success('Audit re-queued')
      router.refresh()
    } catch {
      toast.error(SYSTEM_COPY.errors.retryAudit)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="xs"
      onClick={handleClick}
      loading={loading}
      loadingLabel="Retrying…"
    >
      Retry
    </Button>
  )
}
