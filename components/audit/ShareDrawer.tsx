'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Upload,
  Check,
  Copy,
  Globe,
  Lock,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  Clock,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Callout } from '@/components/ui/callout'
import { Surface } from '@/components/ui/surface'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { SITE_URL, SHARE_COPY } from '@/lib/marketing/copy'
import { getUpgradeMomentContent } from '@/lib/billing/upgrade-moments'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetClose,
} from '@/components/ui/sheet'

interface ShareLink {
  id: string
  token: string
  label: string | null
  expiresAt: string | null
  maxViews: number | null
  viewCount: number
  lastViewedAt: string | null
  revoked: boolean
  createdAt: string
}

interface ShareDrawerProps {
  auditId: string
  score: number | null
  topIssue?: string
  isLoggedIn: boolean
  isOwner: boolean
  isPublic: boolean
  isAnonymous: boolean
  canPublicShare?: boolean
  onPublicChange?: (isPublic: boolean) => void
}

export function ShareDrawer({
  auditId,
  isLoggedIn,
  isOwner,
  isPublic: initialIsPublic,
  isAnonymous,
  canPublicShare = false,
  onPublicChange,
}: ShareDrawerProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [links, setLinks] = useState<ShareLink[]>([])
  const [linksError, setLinksError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(initialIsPublic)

  const [newLabel, setNewLabel] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newExpiry, setNewExpiry] = useState('')
  const [newMaxViews, setNewMaxViews] = useState('')

  const shareUrl = `${SITE_URL}/report/${auditId}`
  const canCreateLinks = isLoggedIn && isOwner && canPublicShare
  const canViewLinks = isLoggedIn && isOwner

  const fetchLinks = useCallback(async () => {
    if (!canViewLinks) return
    setLinksError(false)
    try {
      const res = await fetch(`/api/reports/${auditId}/share-links`)
      if (!res.ok) {
        setLinksError(true)
        return
      }
      const data = await res.json()
      setLinks(data)
    } catch {
      setLinksError(true)
    }
  }, [auditId, canViewLinks])

  useEffect(() => {
    if (open) fetchLinks()
  }, [open, fetchLinks])

  async function handleCreate() {
    setCreating(true)
    try {
      const body: Record<string, unknown> = {}
      if (newLabel) body.label = newLabel
      if (newPassword) body.password = newPassword
      if (newExpiry) body.expiresAt = new Date(newExpiry).toISOString()
      if (newMaxViews) body.maxViews = parseInt(newMaxViews, 10)

      const res = await fetch(`/api/reports/${auditId}/share-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.status === 402) {
        const content = getUpgradeMomentContent('share_public')
        toast.error(content.headline, {
          description: content.body,
          action: {
            label: 'See Agency',
            onClick: () => router.push('/pricing'),
          },
        })
        return
      }

      if (!res.ok) throw new Error((await parseApiErrorResponse(res)).message)

      const link = await res.json()
      setLinks((prev) => [link, ...prev])
      setNewLabel('')
      setNewPassword('')
      setNewExpiry('')
      setNewMaxViews('')
      toast.success('Share link created')

      if (!isPublic) {
        setIsPublic(true)
        onPublicChange?.(true)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create share link')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(linkId: string) {
    try {
      const res = await fetch(`/api/reports/${auditId}/share-links?shareId=${linkId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error((await parseApiErrorResponse(res)).message)
      setLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, revoked: true } : l)))
      toast.success('Link revoked')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not revoke link')
    }
  }

  async function copyToClipboard(text: string, linkId?: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      toast.error('Could not copy the link')
      return
    }
    if (linkId) {
      setCopiedId(linkId)
      setTimeout(() => setCopiedId(null), 2000)
    }
    if (!canPublicShare && isOwner && !isAnonymous && !isPublic && !linkId) {
      toast.success(SHARE_COPY.privateLinkCopied, {
        description: SHARE_COPY.privateLinkCopiedDetail,
      })
      return
    }
    toast.success('Copied to clipboard')
  }

  async function handleMakePublic() {
    if (isPublic) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/${auditId}/toggle-public`, { method: 'PATCH' })
      if (res.status === 402) {
        const content = getUpgradeMomentContent('share_public')
        toast.error(content.headline, {
          description: content.body,
          action: { label: 'See Agency', onClick: () => router.push('/pricing') },
        })
        return
      }
      if (!res.ok) throw new Error((await parseApiErrorResponse(res)).message)
      const data = await res.json()
      setIsPublic(data.isPublic)
      onPublicChange?.(data.isPublic)
      toast.success('Report is now public')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not make report public')
    } finally {
      setLoading(false)
    }
  }

  const activeLinks = links.filter((l) => !l.revoked)
  const revokedLinks = links.filter((l) => l.revoked)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Share
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0">
        <div className="flex items-center justify-between border-b border-border/20 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Share this report</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAnonymous
                ? 'Anyone with the link can view'
                : isPublic
                  ? 'Anyone with the link can view'
                  : SHARE_COPY.privateLinkCopiedDetail}
            </p>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-[44px] w-[44px]">
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {!canPublicShare && isOwner && !isAnonymous && !isPublic && (
            <Callout variant="neutral" title={SHARE_COPY.privateTitle}>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {SHARE_COPY.privateBody}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => copyToClipboard(shareUrl)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {SHARE_COPY.privateLinkCta}
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/pricing">{SHARE_COPY.agencyCta}</Link>
                  </Button>
                </div>
              </div>
            </Callout>
          )}

          {isOwner && !isAnonymous && !isPublic && canPublicShare && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Make this report public to create share links anyone can view.
              </p>
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={handleMakePublic}
                disabled={loading}
              >
                <Globe className="h-4 w-4" />
                Make public
              </Button>
            </div>
          )}

          {(isPublic || isAnonymous || (canPublicShare && isOwner)) && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Report link
                  </Label>
                  {isPublic && (
                    <Badge variant="secondary" className="gap-1 text-3xs font-mono uppercase">
                      <Globe className="h-3 w-3" /> Public
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="flex-1 font-mono text-xs text-muted-foreground"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-2"
                    onClick={() => copyToClipboard(shareUrl)}
                  >
                    {copiedId === 'report' ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Copy
                  </Button>
                </div>
              </div>

              {canCreateLinks && (
                <>
                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Share links
                      </Label>
                      {activeLinks.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {activeLinks.length} active
                        </span>
                      )}
                    </div>

                    {linksError && (
                      <Callout variant="warning" title="Could not load share links">
                        <p className="text-sm text-muted-foreground">
                          Check your connection and try again.
                        </p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => void fetchLinks()}>
                          Retry
                        </Button>
                      </Callout>
                    )}

                    <Card className="p-4 space-y-3">
                      <Input
                        placeholder="Label (e.g. Client review)"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        className="h-11 text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-3xs text-muted-foreground">Password (optional)</Label>
                          <Input
                            placeholder="••••••"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="h-11 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-3xs text-muted-foreground">Max views</Label>
                          <Input
                            placeholder="Unlimited"
                            type="number"
                            min="1"
                            value={newMaxViews}
                            onChange={(e) => setNewMaxViews(e.target.value)}
                            className="h-11 text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-3xs text-muted-foreground">Expires</Label>
                        <Input
                          type="date"
                          value={newExpiry}
                          onChange={(e) => setNewExpiry(e.target.value)}
                          className="h-11 text-xs"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="w-full gap-2"
                        onClick={handleCreate}
                        disabled={creating}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {creating ? 'Creating...' : 'Create share link'}
                      </Button>
                    </Card>
                  </div>

                  {activeLinks.length > 0 && (
                    <div className="space-y-2">
                      {activeLinks.map((link) => {
                        const linkUrl = `${SITE_URL}/api/share/${link.token}`
                        return (
                          <Card
                            key={link.id}
                            className="p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="text-xs font-medium truncate">
                                  {link.label || `Link ${link.token.slice(0, 8)}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-[44px] w-[44px]"
                                  onClick={() => handleRevoke(link.id)}
                                  title="Revoke link"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-3xs text-muted-foreground font-mono">
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {link.viewCount}
                              </span>
                              {link.lastViewedAt && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(link.lastViewedAt).toLocaleDateString()}
                                </span>
                              )}
                              {link.maxViews && (
                                <span>/ {link.maxViews} max</span>
                              )}
                              {link.expiresAt && (
                                <span>Expires {new Date(link.expiresAt).toLocaleDateString()}</span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-11 flex-1 gap-1.5 text-2xs"
                                onClick={() => {
                                  copyToClipboard(linkUrl, link.id)
                                }}
                              >
                                {copiedId === link.id ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                                Copy link
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-[44px] w-[44px] p-0"
                                asChild
                              >
                                <a href={linkUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  )}

                  {activeLinks.length === 0 && (
                    <div className="rounded-card border border-dashed border-border/20 p-6 text-center">
                      <p className="text-xs text-muted-foreground">
                        No share links yet. Create one above.
                      </p>
                    </div>
                  )}

                  {revokedLinks.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Revoked ({revokedLinks.length})
                      </Label>
                      {revokedLinks.map((link) => (
                        <Surface
                          key={link.id}
                          variant="flat"
                          className="p-3 opacity-50"
                        >
                          <div className="flex items-center gap-2">
                            <Lock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground line-through">
                              {link.label || link.token.slice(0, 8)}
                            </span>
                          </div>
                          <p className="text-3xs text-muted-foreground mt-1">
                            {link.viewCount} views · Revoked
                          </p>
                        </Surface>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {!isLoggedIn && !isAnonymous && (
            <Callout variant="info" title="Sign in to share this report">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Create a free account to save and share your reports.
                </p>
                <Button size="sm" asChild className="w-full">
                  <Link href={`/sign-up?next=/report/${auditId}`}>Sign in</Link>
                </Button>
              </div>
            </Callout>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
