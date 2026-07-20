'use client'

import Link from 'next/link'
import { Wrench } from 'lucide-react'
import { MarkdownPromptBox } from '@/components/audit/MarkdownPromptBox'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SeveritySignal } from '@/components/report/SeveritySignal'
import { SAMPLE_FIX } from '@/lib/marketing/copy'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import { buildExpertFixPrompt } from '@/lib/audit/flag-copy'
import { resolveFixPrompt } from '@/lib/audit/priority-flags'
import { impactTagLabel, rubricLabel } from '@/lib/utils'
import { ReportSignupCta } from '@/components/audit/ReportSignupCta'

interface SampleFixCardProps {
  flag: RankableFlag
  totalFlags: number
  signUpHref?: string
}

export function SampleFixCard({ flag, totalFlags, signUpHref = '/sign-up' }: SampleFixCardProps) {
  const rawPrompt = resolveFixPrompt(flag)
  if (!rawPrompt) return null

  const prompt = buildExpertFixPrompt(flag)

  const toolPrompts = {
    universal: flag.agentPrompt,
    cursor: flag.cursorPrompt,
    claude: flag.claudePrompt,
    windsurf: flag.windsurfPrompt,
    lovable: flag.lovablePrompt,
    bolt: flag.boltPrompt,
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
          <Wrench className="h-3 w-3" aria-hidden />
          {SAMPLE_FIX.label}
        </span>
        <p className="text-sm text-muted-foreground">{SAMPLE_FIX.subtext(totalFlags)}</p>
      </div>

      <Card className="overflow-hidden border-0 p-0 shadow-card glass-surface">
        <div className="border-b border-border/30 bg-muted/20 p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <SeveritySignal severity={flag.severity} />
            <span className="meta-label text-muted-foreground">{rubricLabel(flag.rubric)}</span>
            {impactTagLabel(flag.impactTag) ? (
              <span className="text-2xs text-muted-foreground">
                {impactTagLabel(flag.impactTag)}
              </span>
            ) : null}
          </div>
          <p className="text-sm font-medium leading-snug text-pretty">{flag.problem}</p>
        </div>

        <div className="space-y-2.5 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <h4 className="text-sm font-medium text-foreground">{SAMPLE_FIX.fixTitle}</h4>
          </div>
          <MarkdownPromptBox
            prompt={prompt}
            toolPrompts={toolPrompts}
            showToolSelector
            showCursorAction
            nested
          />
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <ReportSignupCta href={signUpHref} from="sample_fix">
          {SAMPLE_FIX.primaryCta}
        </ReportSignupCta>
        <Button variant="outline" asChild>
          <Link href="/sign-in">{SAMPLE_FIX.signInCta}</Link>
        </Button>
      </div>
    </section>
  )
}
