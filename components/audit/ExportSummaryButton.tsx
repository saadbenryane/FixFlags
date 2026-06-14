'use client'

import { useState } from 'react'
import { FileText, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { buildAuditExportSummary } from '@/lib/audit/export-summary'

interface ExportArea {
  name: string
  grade: string | null
  score: number | null
  findings?: Array<{ severity: string; problem: string }>
}

interface ExportSummaryButtonProps {
  auditId: string
  url: string
  score: number | null
  verdict?: string | null
  areas: ExportArea[]
  size?: 'sm' | 'default'
}

export function ExportSummaryButton({
  auditId,
  url,
  score,
  verdict,
  areas,
  size = 'sm',
}: ExportSummaryButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const findings = areas.flatMap((area) =>
      (area.findings ?? []).map((f) => ({ ...f, area: area.name }))
    )
    const summary = buildAuditExportSummary({
      auditId,
      url,
      score,
      verdict,
      areas,
      findings,
    })

    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Summary copied', {
        description: 'Paste into Slack, email, or your client handoff doc.',
      })
    } catch {
      toast.error('Could not copy summary')
    }
  }

  return (
    <Button variant="outline" size={size} onClick={handleCopy} className="gap-2">
      {copied ? (
        <>
          <Check className="h-4 w-4" /> Copied
        </>
      ) : (
        <>
          <FileText className="h-4 w-4" /> Copy summary
        </>
      )}
    </Button>
  )
}
