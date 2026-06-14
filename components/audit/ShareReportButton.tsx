'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface ShareReportButtonProps {
  url: string
  score: number | null
  topIssue?: string
}

export function ShareReportButton({ url, score, topIssue }: ShareReportButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      const shareData = score != null
        ? `QualityOS report: ${score}/100 — ${topIssue ?? ''}`
        : 'QualityOS audit report'
      toast.success('Link copied to clipboard', {
        description: shareData,
      })
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      className="gap-2"
    >
      {copied ? (
        <><Check className="h-4 w-4" /> Copied</>
      ) : (
        <><Share2 className="h-4 w-4" /> Share audit</>
      )}
    </Button>
  )
}
