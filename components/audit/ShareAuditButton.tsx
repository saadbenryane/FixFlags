'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { SITE_URL } from '@/lib/marketing/copy'

interface ShareAuditButtonProps {
  auditId: string
  score: number | null
  topIssue?: string
  isLoggedIn: boolean
  isOwner: boolean
  isPublic: boolean
  isAnonymous: boolean
  onPublicChange?: (isPublic: boolean) => void
  size?: 'sm' | 'default'
}

export function ShareAuditButton({
  auditId,
  score,
  topIssue,
  isLoggedIn,
  isOwner,
  isPublic,
  isAnonymous,
  onPublicChange,
  size = 'sm',
}: ShareAuditButtonProps) {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const shareUrl = `${SITE_URL}/audit/${auditId}`
  const canShare = isAnonymous || isPublic || (isLoggedIn && isOwner)

  if (!canShare) return null

  async function handleShare() {
    setLoading(true)
    try {
      let publicNow = isPublic || isAnonymous

      if (isLoggedIn && isOwner && !isAnonymous && !isPublic) {
        const res = await fetch(`/api/audits/${auditId}/toggle-public`, { method: 'PATCH' })
        if (!res.ok) {
          const parsed = await res.json().catch(() => null)
          if (res.status === 402) {
            toast.error('Agency plan required', {
              description: 'Public share links are included on Agency and above.',
            })
          } else {
            toast.error(parsed?.message ?? 'Could not make report public')
          }
          return
        }
        const data = await res.json()
        publicNow = data.isPublic
        onPublicChange?.(data.isPublic)
      }

      const url = shareUrl
      const shareText =
        score != null
          ? `QualityOS report: ${score}/100${topIssue ? ` — ${topIssue}` : ''}`
          : 'QualityOS audit report'

      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: 'QualityOS audit', text: shareText, url })
          return
        } catch {
          // fall through to clipboard
        }
      }

      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success(publicNow ? 'Public link copied' : 'Link copied', {
        description: publicNow
          ? 'Anyone with this link can view the report.'
          : shareText,
      })
    } catch {
      toast.error('Could not copy link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size={size} onClick={handleShare} disabled={loading} className="gap-2">
      {copied ? (
        <>
          <Check className="h-4 w-4" /> Copied
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" /> Share audit
        </>
      )}
    </Button>
  )
}
