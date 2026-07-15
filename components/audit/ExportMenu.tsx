'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, FileText, Lock } from 'lucide-react'
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
import { buildAuditExportSummary } from '@/lib/audit/export-summary'
import {
  buildPlanModePrompt,
  collectAllFixPrompts,
  collectFixPromptsByRubric,
  countFixPrompts,
  countFixPromptsByRubric,
} from '@/lib/audit/priority-flags'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { rubricLabel } from '@/lib/utils'
import { getUpgradeMomentContent } from '@/lib/billing/upgrade-moments'

interface ExportRubric {
  name: string
  grade: string | null
  score: number | null
  flags?: Array<{ severity: string; problem: string; rubric?: string }>
}

interface ExportMenuProps {
  auditId: string
  url: string
  score: number | null
  verdict?: string | null
  rubrics: ExportRubric[]
  flags: RankableFlag[]
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
  canExportSummary = false,
  showFixPrompts = false,
  size = 'sm',
}: ExportMenuProps) {
  const router = useRouter()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  async function copyText(key: string, text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
      toast.success(successMessage)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  async function handleCopySummary() {
    if (!canExportSummary) {
      const content = getUpgradeMomentContent('export_locked')
      toast.error(content.headline, {
        description: content.body,
        action: {
          label: 'See Agency',
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
    await copyText('summary', summary, 'Report summary copied')
  }

  const totalPrompts = countFixPrompts(flags)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="gap-2">
          {copiedKey ? (
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
                copyText('fix-plan', buildPlanModePrompt(flags, { url }), 'Copied fix plan prompt')
              }
            >
              Fix plan for your editor
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                copyText('all-prompts', collectAllFixPrompts(flags), `Copied ${totalPrompts} fix prompts`)
              }
            >
              All prompts ({totalPrompts})
            </DropdownMenuItem>
            {RUBRIC_ORDER.map((rubric) => {
              const count = countFixPromptsByRubric(flags, rubric)
              if (count === 0) return null
              return (
                <DropdownMenuItem
                  key={rubric}
                  onClick={() =>
                    copyText(
                      rubric,
                      collectFixPromptsByRubric(flags, rubric),
                      `Copied ${count} ${rubricLabel(rubric)} prompts`
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
  )
}
