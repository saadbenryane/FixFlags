'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Check, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { buildAuditExportSummary } from '@/lib/audit/export-summary'
import { getUpgradeMomentContent } from '@/lib/billing/upgrade-moments'

interface ExportRubric {
  name: string
  grade: string | null
  score: number | null
  flags?: Array<{ severity: string; problem: string; rubric?: string }>
}

interface ExportSummaryButtonProps {
  auditId: string
  url: string
  score: number | null
  verdict?: string | null
  rubrics: ExportRubric[]
  canExport?: boolean
  size?: 'sm' | 'default'
}

export function ExportSummaryButton({
  auditId,
  url,
  score,
  verdict,
  rubrics,
  canExport = false,
  size = 'sm',
}: ExportSummaryButtonProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!canExport) {
      const content = getUpgradeMomentContent('export_locked')
      toast.error(content.headline, {
        description: content.body,
        action: {
          label: 'See Max',
          onClick: () => router.push('/pricing'),
        },
      })
      return
    }

    const flags = rubrics.flatMap((rubric) =>
      (rubric.flags ?? []).map((flag) => ({
        ...flag,
        rubric: flag.rubric ?? rubric.name,
      }))
    )
    const summary = buildAuditExportSummary({
      auditId,
      url,
      score,
      verdict,
      rubrics,
      flags,
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
      ) : canExport ? (
        <>
          <FileText className="h-4 w-4" /> Copy summary
        </>
      ) : (
        <>
          <Lock className="h-4 w-4" /> Copy summary
        </>
      )}
    </Button>
  )
}
