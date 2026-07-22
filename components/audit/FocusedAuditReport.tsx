import type { Route } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { RecheckCompletedTracker } from '@/components/audit/RecheckCompletedTracker'
import { RecheckDiffStrip } from '@/components/audit/RecheckDiffStrip'
import { ReportRecheckButton } from '@/components/audit/ReportRecheckButton'
import { RubricBar } from '@/components/audit/RubricBar'
import { ReportSignupCta } from '@/components/audit/ReportSignupCta'
import { SeveritySignal } from '@/components/report/SeveritySignal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Callout } from '@/components/ui/callout'
import { Container } from '@/components/ui/container'
import { SectionTitle } from '@/components/ui/typography'
import { displayVerdict } from '@/lib/audit/verdict'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { shareStatusMessage } from '@/lib/audit/share-status'
import type { ReportViewModel } from '@/lib/report/report-view-model'
import { impactTagLabel, rubricLabel } from '@/lib/utils'
import { FocusedReportTracker } from '@/components/audit/FocusedReportTracker'
import type { ReportAccessState } from '@/lib/analytics/events'

export function FocusedAuditReport({ model }: { model: ReportViewModel }) {
  const verdict = displayVerdict(model.summary.verdict)
  const demonstratedIndex = model.finishPlan.items.findIndex((item) => item.prompt)
  const accessState: ReportAccessState = model.access.isOwner
    ? 'owner'
    : model.access.isLoggedIn
      ? 'signed_in'
      : 'anonymous'
  const copyNextStep = model.recheck.canRecheck
    ? REPORT_COPY.focused.copyNextStepOwner
    : REPORT_COPY.focused.copyNextStepAnonymous

  return (
    <Container variant="report" className="space-y-8 py-6 sm:py-10">
      <FocusedReportTracker
        auditId={model.summary.auditId}
        accessState={accessState}
        itemCount={model.finishPlan.items.length}
        firstFinding={model.finishPlan.items[0] ?? null}
      />
      <AuditReportHero
        score={model.summary.score}
        pageType={model.summary.pageType}
        url={model.summary.url}
        screenshots={model.summary.screenshots}
      />

      <Callout
        variant={model.summary.shareStatus === 'good_to_share' ? 'success' : 'warning'}
        title={shareStatusMessage(model.summary.shareStatus)}
      >
        {REPORT_COPY.focused.readinessBody}
      </Callout>

      {verdict ? (
        <blockquote className="max-w-4xl border-l-2 border-brand pl-4 font-sans text-base font-medium leading-[1.5] text-pretty sm:text-lg">
          {verdict}
        </blockquote>
      ) : null}

      {model.recheck.diff ? (
        <div className="space-y-3">
          {model.recheck.parentId ? (
            <RecheckCompletedTracker
              auditId={model.summary.auditId}
              parentAuditId={model.recheck.parentId}
              outcome="report_diff"
            />
          ) : null}
          <RecheckDiffStrip summary={model.recheck.diff} compareHref={model.recheck.compareHref} />
        </div>
      ) : null}

      <section id="report-finish-plan" className="scroll-mt-[var(--header-offset)] space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-label mb-2">{REPORT_COPY.focused.eyebrow}</p>
            <SectionTitle>{REPORT_COPY.sectionTitles.topPriorities}</SectionTitle>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
              {REPORT_COPY.sectionTitles.topPrioritiesHint}
            </p>
          </div>
          {model.finishPlan.copyPrompt ? (
            <PromptCopyButton
              prompt={model.finishPlan.copyPrompt}
              label={REPORT_COPY.sectionTitles.copyFixPlan(model.finishPlan.visiblePromptCount)}
              kind="plan"
              auditId={model.summary.auditId}
              surface="focused"
              accessState={accessState}
              nextStep={copyNextStep}
            />
          ) : null}
        </div>

        <ol className="grid gap-4">
          {model.finishPlan.items.map((item, index) => {
            const impact = impactTagLabel(item.impactTag)
            return (
              <li key={item.id}>
                <Card variant={index === 0 ? 'strong' : 'default'} className="overflow-hidden p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground font-mono text-sm font-bold text-background">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-4">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <SeveritySignal severity={item.severity} />
                          <span className="meta-label text-muted-foreground">
                            {rubricLabel(item.rubricName)}
                          </span>
                          {impact ? <span className="text-2xs text-muted-foreground">{impact}</span> : null}
                        </div>
                        <h2 className="text-base font-semibold leading-snug tracking-heading text-pretty sm:text-lg">
                          {item.problem}
                        </h2>
                      </div>

                      {item.evidence ? (
                        <div className="rounded-[var(--radius-inner)] bg-muted/45 p-4">
                          <p className="meta-label mb-1.5 text-muted-foreground">{REPORT_COPY.focused.evidence}</p>
                          <p className="text-sm leading-relaxed text-foreground/85 text-pretty">{item.evidence}</p>
                        </div>
                      ) : null}

                      {item.prompt ? (
                        <div className="space-y-2">
                          <p className="meta-label text-muted-foreground">{REPORT_COPY.focused.fix}</p>
                          <FixPromptBlock
                            prompt={item.prompt}
                            toolPrompts={item.toolPrompts ?? undefined}
                            showToolSelector
                            rows={3}
                            variant="compact"
                            nested
                            auditId={model.summary.auditId}
                            surface="focused"
                            accessState={accessState}
                            itemPosition={index + 1}
                            copyNextStep={copyNextStep}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>

                {model.access.promptAccess === 'one' && index === demonstratedIndex ? (
                  <Card className="mt-4 flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                      <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
                      <div>
                        <p className="font-medium">{REPORT_COPY.focused.signUpCta}</p>
                        <p className="mt-1 text-sm text-muted-foreground text-pretty">
                          {REPORT_COPY.focused.promptLocked}
                        </p>
                      </div>
                    </div>
                    <ReportSignupCta href={model.access.signUpHref} from="sample_fix" className="min-h-11 shrink-0">
                      {REPORT_COPY.focused.signUpCta}
                    </ReportSignupCta>
                  </Card>
                ) : null}
              </li>
            )
          })}
        </ol>
      </section>

      <section aria-labelledby="rubric-proof-title" className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
          <h2 id="rubric-proof-title" className="text-sm font-semibold">
            {REPORT_COPY.focused.rubricProof}
          </h2>
        </div>
        <RubricBar rubrics={model.summary.rubrics} rubricRows={model.summary.rubricRows} />
      </section>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline" className="min-h-11">
          <Link href={model.details.href as Route}>
            {REPORT_COPY.focused.detailsCta(model.details.flagCount)}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        {model.recheck.canRecheck ? <ReportRecheckButton auditId={model.summary.auditId} /> : null}
      </div>
    </Container>
  )
}
