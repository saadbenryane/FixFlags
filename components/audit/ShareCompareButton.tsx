'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Check, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { SITE_URL } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard'

interface Props {
  auditId: string
  label?: string
}

export function ShareCompareButton({ auditId, label = 'Share comparison' }: Props) {
  const router = useRouter()
  const { copied, copy } = useCopyToClipboard()
  const [link, setLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/${auditId}/share-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Compare view' }),
      })

      if (res.status === 402) {
        toast.error('Share links require the Studio plan', {
          action: { label: 'See Studio', onClick: () => router.push('/pricing') },
        })
        return
      }

      if (!res.ok) throw new Error()
      const data = await res.json()
      const url = `${SITE_URL}/compare/${auditId}?share=${data.token}`
      setLink(url)
      trackEvent('share_link_created', { audit_id: auditId, kind: 'compare' })
    } catch {
      toast.error('Could not create share link')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!link) return
    await copy(link, { kind: 'link', auditId, successMessage: 'Compare link copied' })
  }

  if (!link) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleCreate}
        loading={loading}
        loadingLabel="Creating…"
      >
        <Share2 className="h-4 w-4" />
        {label}
      </Button>
    )
  }

  return (
    <Card className="flex items-center gap-2 p-3">
      <Input
        value={link}
        readOnly
        className="h-11 flex-1 text-xs font-mono"
        onClick={(e) => e.currentTarget.select()}
      />
      <Button variant="outline" size="sm" className="h-11 gap-1.5 shrink-0" onClick={copyLink}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        Copy
      </Button>
      <Button variant="ghost" size="icon" className="h-[44px] w-[44px] shrink-0" asChild>
        <a href={link} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Button>
    </Card>
  )
}
