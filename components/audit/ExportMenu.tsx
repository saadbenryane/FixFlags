'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, FileText, Link, Lock, Eye, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { PromptPreviewModal } from '@/components/audit/PromptPreviewModal'
import { KeepReportEmail } from '@/components/report/KeepReportEmail'
import { buildAuditExportSummary } from '@/lib/audit/export-summary'
import {
  collectFixPromptsByRubric,
  countFixPrompts,
  countFixPromptsByRubric,
} from '@/lib/audit/priority-flags'
import { buildAllFixPrompts } from '@/lib/audit/finish-plan'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { rubricLabel } from '@/lib/utils'
import { getUpgradeMomentContent } from '@/lib/billing/upgrade-moments'
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard'
import { SITE_URL, REPORT_COPY } from '@/lib/marketing/copy'

interface ExportRubric {
  name: string
  grade: string | null
  score: number | null
  rubricPrompt?: string | null
  flags?: Array<{ severity: string; problem: string; rubric?: string }>
}

interface ExportMenuProps {
  auditId: string
  url: string
  score: number | null
  verdict?: string | null
  rubrics: ExportRubric[]
  flags: RankableFlag[]
  contract?: import('@/lib/audit/product-contract').ProductContract | null
  canExportSummary?: boolean
  showFixPrompts?: boolean
  size?: 'sm' | 'default'
}

export function ExportMenu({
  auditId,
  url,
  score,
  verdict,
  rubrics,
  flags,
  contract = null,
  canExportSummary = false,
  showFixPrompts = false,
  size = 'sm',
}: ExportMenuProps) {
  const router = useRouter()
  const { copied, copy } = useCopyToClipboard()
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('Fix prompt preview')
  const [emailOpen, setEmailOpen] = useState(false)

  function openPreview(title: string, text: string) {
    setPreviewTitle(title)
    setPreviewPrompt(text)
  }

  async function handleCopySummary() {
    if (!canExportSummary) {
      const content = getUpgradeMomentContent('export_locked')
      toast.error(content.headline, {
        description: content.body,
        action: {
          label: 'See Studio',
          onClick: () => router.push('/pricing'),
        },
      })
      return
    }

    const flatFlags = rubrics.flatMap((rubric) =>
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
      flags: flatFlags,
    })
    await copy(summary, { kind: 'export', auditId, successMessage: 'Report summary copied' })
  }

  async function handleCopyLink() {
    await copy(`${SITE_URL}/report/${auditId}`, {
      kind: 'link',
      auditId,
      successMessage: 'Report link copied',
    })
  }

  const totalPrompts = countFixPrompts(flags)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} className="gap-2">
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Export
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Copy to clipboard</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleCopyLink} className="gap-2">
            <Link className="h-4 w-4" />
            Report link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEmailOpen(true)} className="gap-2">
            <Mail className="h-4 w-4" />
            {REPORT_COPY.keepReport.title}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCopySummary} className="gap-2">
            {canExportSummary ? (
              <FileText className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Report summary
          </DropdownMenuItem>
          {showFixPrompts && totalPrompts > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Fix prompts</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() =>
                  openPreview(
                    `Complete Fix List (${totalPrompts})`,
                    buildAllFixPrompts({ flags, url, contract })
                  )
                }
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Complete Fix List ({totalPrompts})
              </DropdownMenuItem>
              {RUBRIC_ORDER.map((rubric) => {
                const count = countFixPromptsByRubric(flags, rubric)
                if (count === 0) return null
                const rubricRow = rubrics.find((r) => r.name === rubric)
                const rubricHeader = rubricRow?.rubricPrompt
                  ? `=== ${rubricLabel(rubric)} fix plan ===\n${rubricRow.rubricPrompt}\n\n`
                  : ''
                return (
                  <DropdownMenuItem
                    key={rubric}
                    onClick={() =>
                      copy(
                        rubricHeader + collectFixPromptsByRubric(flags, rubric),
                        {
                          kind: 'export',
                          auditId,
                          successMessage: `Copied ${count} ${rubricLabel(rubric)} prompts`,
                        }
                      )
                    }
                  >
                    {rubricLabel(rubric)} ({count})
                  </DropdownMenuItem>
                )
              })}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {previewPrompt && (
        <PromptPreviewModal
          open={Boolean(previewPrompt)}
          onOpenChange={(open) => {
            if (!open) setPreviewPrompt(null)
          }}
          prompt={previewPrompt}
          title={previewTitle}
        />
      )}
      <KeepReportEmail auditId={auditId} open={emailOpen} onOpenChange={setEmailOpen} />
    </>
  )
}
