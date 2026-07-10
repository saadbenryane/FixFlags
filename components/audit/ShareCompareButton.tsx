'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Check, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { SITE_URL } from '@/lib/marketing/copy'

interface Props {
  auditId: string
  label?: string
}

export function ShareCompareButton({ auditId, label = 'Share comparison' }: Props) {
  const router = useRouter()
  const [link, setLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/audits/${auditId}/share-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Compare view' }),
      })

      if (res.status === 402) {
        toast.error('Share links require the Agency plan', {
          action: { label: 'See Agency', onClick: () => router.push('/pricing') },
        })
        return
      }

      if (!res.ok) throw new Error()
      const data = await res.json()
      const url = `${SITE_URL}/compare/${auditId}?share=${data.token}`
      setLink(url)
    } catch {
      toast.error('Could not create share link')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Compare link copied')
  }

  if (!link) {
    return (
      <Button variant="outline" size="sm" className="gap-2" onClick={handleCreate} disabled={loading}>
        <Share2 className="h-4 w-4" />
        {loading ? 'Creating...' : label}
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card p-3">
      <Input
        value={link}
        readOnly
        className="h-8 flex-1 text-xs font-mono"
        onClick={(e) => e.currentTarget.select()}
      />
      <Button variant="outline" size="sm" className="h-8 gap-1.5 shrink-0" onClick={copyLink}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        Copy
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
        <a href={link} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  )
}
