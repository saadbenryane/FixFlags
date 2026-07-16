'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Download, Check, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const

interface DigestResponse {
  markdown: string
  counts: {
    conversations: number
    reportReactions: number
    flagReactions: number
    comments: number
  }
}

export function FeedbackDigestPanel() {
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<DigestResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (nextDays: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/feedback/export?days=${nextDays}`)
      if (!res.ok) throw new Error('failed')
      setData((await res.json()) as DigestResponse)
    } catch {
      toast.error('Could not build the digest. Try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(days)
  }, [days, load])

  async function handleCopy() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.markdown)
      setCopied(true)
      toast.success('Copied. Paste it into your AI assistant.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Clipboard blocked. Use Download instead.')
    }
  }

  function handleDownload() {
    const a = document.createElement('a')
    a.href = `/api/admin/feedback/export?days=${days}&format=md`
    a.download = `feedback-digest-${days}d.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const counts = data?.counts

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Window:</span>
          {RANGES.map((r) => (
            <Button
              key={r.days}
              size="sm"
              variant={days === r.days ? 'default' : 'ghost'}
              onClick={() => setDays(r.days)}
              className="text-xs"
            >
              {r.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void load(days)} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={!data}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download .md
          </Button>
          <Button size="sm" onClick={() => void handleCopy()} disabled={!data}>
            {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy for AI'}
          </Button>
        </div>
      </div>

      {counts && (
        <p className="text-xs text-muted-foreground">
          {counts.conversations} conversations · {counts.reportReactions} report reactions ·{' '}
          {counts.flagReactions} flag reactions · {counts.comments} written comments
        </p>
      )}

      <Card variant="solid" className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">Preview</span>
        </div>
        <pre className="max-h-[28rem] overflow-auto p-4 text-xs leading-relaxed whitespace-pre-wrap break-words">
          {loading && !data ? 'Building digest…' : data?.markdown ?? 'No data.'}
        </pre>
      </Card>
    </div>
  )
}
