'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw, Share2, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  auditId: string
  isPaid: boolean
  isLoggedIn: boolean
  isPublic: boolean
  hasParent: boolean
}

export function AuditPageActions({ auditId, isPaid, isLoggedIn, isPublic: initialIsPublic, hasParent }: Props) {
  const router = useRouter()
  const [isPublic, setIsPublic] = useState(initialIsPublic)

  async function handleShare() {
    try {
      const res = await fetch(`/api/audits/${auditId}/toggle-public`, { method: 'PATCH' })
      const data = await res.json()
      if (res.ok) {
        setIsPublic(data.isPublic)
        if (data.isPublic) {
          await navigator.clipboard.writeText(window.location.href)
          toast.success('Report is now public. URL copied to clipboard.')
        } else {
          toast.success('Report is now private.')
        }
      } else {
        toast.error(data.error || 'Failed to update sharing')
      }
    } catch {
      toast.error('Failed to update sharing')
    }
  }

  async function handleRecheck() {
    const res = await fetch(`/api/audits/${auditId}/recheck`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      router.push(`/audit/${data.auditId}`)
    } else {
      toast.error(data.error || 'Failed to start re-check')
    }
  }

  return (
    <>
      {hasParent && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/compare/${auditId}`}>
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            View comparison
          </Link>
        </Button>
      )}
      {isLoggedIn && (
        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2 className="h-4 w-4 mr-2" />
          {isPublic ? 'Make private' : 'Share'}
        </Button>
      )}
      {isPaid && (
        <Button size="sm" onClick={handleRecheck}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Re-check
        </Button>
      )}
    </>
  )
}
