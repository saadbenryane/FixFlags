'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Share2, Check, Globe, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { BRAND, SITE_URL } from '@/lib/marketing/copy'
import { getUpgradeMomentContent } from '@/lib/billing/upgrade-moments'

interface ShareAuditButtonProps {
  auditId: string
  score: number | null
  topIssue?: string
  isLoggedIn: boolean
  isOwner: boolean
  isPublic: boolean
  isAnonymous: boolean
  canPublicShare?: boolean
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
  canPublicShare = false,
  onPublicChange,
  size = 'sm',
}: ShareAuditButtonProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const shareUrl = `${SITE_URL}/report/${auditId}`
  const canShare = isAnonymous || isPublic || (isLoggedIn && isOwner)
  const shareState = isAnonymous ? 'anonymous' : isPublic ? 'public' : 'private'

  if (!canShare && !(isLoggedIn && isOwner)) return null

  async function copyLink(publicNow: boolean) {
    const shareText =
      score != null
        ? `${BRAND.name} report: ${score}/100${topIssue ? ` - ${topIssue}` : ''}`
        : `${BRAND.name} report`

    if (typeof navigator.share === 'function' && publicNow) {
      try {
        await navigator.share({ title: `${BRAND.name} report`, text: shareText, url: shareUrl })
        return
      } catch {
        // fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    if (publicNow) {
      toast.success('Public link copied', {
        description: 'Anyone with this link can view the report.',
      })
    } else {
      toast.success('Private link copied', {
        description:
          'Only you can view this report while it is private. Upgrade to Max for public share links.',
      })
    }
  }

  async function handleShare() {
    setLoading(true)
    try {
      if (isLoggedIn && isOwner && !isAnonymous && !isPublic && !canPublicShare) {
        await copyLink(false)
        return
      }

      if (isLoggedIn && isOwner && !isAnonymous && !isPublic && canPublicShare) {
        const res = await fetch(`/api/audits/${auditId}/toggle-public`, { method: 'PATCH' })
        if (!res.ok) {
          if (res.status === 402) {
            const content = getUpgradeMomentContent('share_public')
            toast.error(content.headline, {
              description: content.body,
              action: {
                label: 'See Max',
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
        onPublicChange?.(data.isPublic)
        await copyLink(true)
        return
      }

      await copyLink(isPublic || isAnonymous)
    } catch {
      toast.error('Could not copy link')
    } finally {
      setLoading(false)
    }
  }

  const shareLabel =
    isOwner && !isAnonymous && !canPublicShare && !isPublic
      ? 'Copy private link'
      : isOwner && !isAnonymous && !isPublic && canPublicShare
        ? 'Make public & share'
        : 'Share report'

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
      <Button
        variant="outline"
        size={size}
        onClick={handleShare}
        disabled={loading}
        className="gap-2"
        title={
          isOwner && !canPublicShare && !isPublic
            ? 'Private reports are only visible to you'
            : undefined
        }
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" /> Copied
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" /> {shareLabel}
          </>
        )}
      </Button>
      {isOwner && !isPublic && !isAnonymous && !canPublicShare && (
        <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
          <Link href="/pricing">Max for public links</Link>
        </Button>
      )}
    </div>
  )
}
