'use client'

import Link from 'next/link'
import { ClipboardCheck, Lightbulb, ScanSearch, Sparkles } from 'lucide-react'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SeverityBadge } from '@/components/audit/SeverityBadge'
import { SAMPLE_FIX } from '@/lib/marketing/copy'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import { resolveFixPrompt } from '@/lib/audit/priority-flags'
import { rubricLabel } from '@/lib/utils'

interface SampleFixCardProps {
  flag: RankableFlag
  totalFlags: number
  signUpHref?: string
}

function SampleFlagCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[var(--radius-inner)] border border-border/40 bg-muted/15 p-4 sm:p-5">
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
      </div>
      {children}
    </section>
  )
}

export function SampleFixCard({ flag, totalFlags, signUpHref = '/sign-up' }: SampleFixCardProps) {
  const prompt = resolveFixPrompt(flag)
  if (!prompt) return null

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
          <Sparkles className="h-3 w-3" aria-hidden />
          {SAMPLE_FIX.label}
        </span>
        <p className="text-sm text-muted-foreground">{SAMPLE_FIX.subtext(totalFlags)}</p>
      </div>

      <Card className="overflow-hidden border-0 p-0 shadow-card glass-surface">
        <div className="border-b border-border/30 bg-muted/20 p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <SeverityBadge severity={flag.severity} />
            <span className="meta-label text-muted-foreground">{rubricLabel(flag.rubric)}</span>
          </div>
          <p className="text-sm font-medium leading-snug text-pretty">{flag.problem}</p>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          {flag.whyItMatters && (
            <SampleFlagCard title={SAMPLE_FIX.whyTitle} icon={Lightbulb}>
              <p className="text-sm leading-relaxed text-foreground/90 text-pretty">{flag.whyItMatters}</p>
            </SampleFlagCard>
          )}

          {flag.evidence && (
            <SampleFlagCard title={SAMPLE_FIX.evidenceTitle} icon={ScanSearch}>
              <p className="text-sm leading-relaxed text-foreground/90 text-pretty">{flag.evidence}</p>
            </SampleFlagCard>
          )}

          {flag.verificationRule && (
            <SampleFlagCard title={SAMPLE_FIX.verifyTitle} icon={ClipboardCheck}>
              <p className="text-sm leading-relaxed text-foreground/90 text-pretty">
                {flag.verificationRule}
              </p>
            </SampleFlagCard>
          )}

          <section className="rounded-[var(--radius-inner)] border border-brand/20 bg-brand/5 p-4 sm:p-5">
            <div className="mb-2.5 flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              <h4 className="text-sm font-medium text-brand">{SAMPLE_FIX.fixTitle}</h4>
            </div>
            <FixPromptBlock
              prompt={prompt}
              toolPrompts={toolPrompts}
              showToolSelector
              clamp={false}
              showCursorAction
              variant="compact"
              nested
            />
          </section>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={signUpHref}>{SAMPLE_FIX.primaryCta}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/sign-in">{SAMPLE_FIX.signInCta}</Link>
        </Button>
      </div>
    </section>
  )
}

