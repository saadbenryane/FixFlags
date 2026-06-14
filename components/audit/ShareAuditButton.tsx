'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Share2, Check, Globe, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { SITE_URL } from '@/lib/marketing/copy'
import { getUpgradeMomentContent } from '@/lib/billing/upgrade-moments'

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
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const shareUrl = `${SITE_URL}/audit/${auditId}`
  const canShare = isAnonymous || isPublic || (isLoggedIn && isOwner)
  const shareState = isAnonymous ? 'anonymous' : isPublic ? 'public' : 'private'

  if (!canShare && !(isLoggedIn && isOwner)) return null

  async function handleShare() {
    setLoading(true)
    try {
      let publicNow = isPublic || isAnonymous

      if (isLoggedIn && isOwner && !isAnonymous && !isPublic) {
        const res = await fetch(`/api/audits/${auditId}/toggle-public`, { method: 'PATCH' })
        if (!res.ok) {
          if (res.status === 402) {
            const content = getUpgradeMomentContent('share_public')
            toast.error(content.headline, {
              description: content.body,
              action: {
                label: 'See Agency',
                onClick: () => router.push('/pricing'),
              },
            })
          } else {
            const parsed = await res.json().catch(() => null)
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
          ? 'Anyone with this link can view the report and run their own audit.'
          : shareText,
      })
    } catch {
      toast.error('Could not copy link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isOwner && !isAnonymous && (
        <Badge variant="secondary" className="gap-1 text-[10px] font-mono uppercase tracking-label">
          {shareState === 'public' ? (
            <>
              <Globe className="h-3 w-3" /> Public
            </>
          ) : (
            <>
              <Lock className="h-3 w-3" /> Private
            </>
          )}
        </Badge>
      )}
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
      {isOwner && !isPublic && !isAnonymous && (
        <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
          <Link href="/pricing">Agency for public links</Link>
        </Button>
      )}
    </div>
  )
}
