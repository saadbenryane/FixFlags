'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, ExternalLink, Share2, type LucideIcon } from 'lucide-react'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { ReportClaimDialog } from '@/components/auth/ReportClaimDialog'
import { FlagFeedback } from '@/components/audit/FlagFeedback'
import { RubricPill } from '@/components/marketing/sample/RubricDimensionHeader'
import { SeveritySignal } from '@/components/report/SeveritySignal'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ExplorerFlag } from '@/lib/report/explorer-model'
import type { PreviewMeta } from '@/lib/audit/preview-meta'
import { displayHostname, truncatePreview } from '@/lib/audit/preview-meta'
import { impactTagIcon } from '@/lib/rubric-icons'
import { impactTagLabel } from '@/lib/utils'
import type { ReportAccessState, ReportSurface } from '@/lib/analytics/events'

export interface ReportOwnerActionContext {
  auditId: string
  surface: ReportSurface
  accessState: Extract<ReportAccessState, 'owner'>
}

/** Check IDs where the issue is about social/shareable previews. */
const SHAREABLE_CHECK_IDS = new Set([
  'og-image-missing',
  'og-image-broken',
  'og-title-missing',
  'og-description-missing',
])

export function isShareableCheck(checkId: string | null | undefined): boolean {
  return Boolean(checkId && SHAREABLE_CHECK_IDS.has(checkId))
}

function InlineSocialPreview({ preview, checkId }: { preview: PreviewMeta; checkId: string | null }) {
  const title = preview.ogTitle ?? preview.title ?? 'Missing title'
  const description = preview.ogDescription ?? preview.description ?? 'Missing description'
  const hostname = displayHostname(preview.url)
  const hasImage = Boolean(preview.ogImage)
  const imageOk = preview.ogImageOk

  return (
    <FlagCard title="Current social preview" icon={Share2}>
      <p className="mb-3 text-xs text-muted-foreground">
        This is how your page appears when shared on Slack, LinkedIn, or iMessage.
      </p>
      <div className="max-w-sm overflow-hidden rounded-md ring-1 ring-border/60 bg-card">
        {hasImage && imageOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.ogImage!}
            alt=""
            width={1200}
            height={630}
            loading="lazy"
            className="aspect-[1.91/1] w-full bg-muted object-cover"
          />
        ) : hasImage && !imageOk ? (
          <div className="flex aspect-[1.91/1] w-full flex-col items-center justify-center gap-1 bg-muted px-4 text-center text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Image unavailable</span>
            <span className="text-xs">The og:image URL does not load</span>
          </div>
        ) : (
          <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
            {checkId === 'og-image-missing'
              ? 'No og:image set, blank card when shared'
              : 'No image preview'}
          </div>
        )}
        <div className="space-y-1 border-t border-border/60 p-3">
          <p className="text-3xs uppercase tracking-wide text-muted-foreground">{hostname}</p>
          <p className="line-clamp-2 text-sm font-semibold leading-snug">
            {checkId === 'og-title-missing' ? (
              <span className="text-muted-foreground italic">No og:title, falls back to page title</span>
            ) : (
              truncatePreview(title, 70) || 'Missing title'
            )}
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {checkId === 'og-description-missing' ? (
              <span className="italic">No og:description, falls back to meta description</span>
            ) : (
              truncatePreview(description, 120) || 'Missing description'
            )}
          </p>
        </div>
      </div>
    </FlagCard>
  )
}

function FlagCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
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

function FlagEvidenceMeta({ flag }: { flag: ExplorerFlag }) {
  const hasMedia = Boolean(flag.visualUrl)
  const pageUrls = flag.pageUrls.length > 0 ? flag.pageUrls : flag.pageUrl ? [flag.pageUrl] : []
  const hasLinks = pageUrls.length > 0
  if (!hasMedia && !hasLinks) return null

  return (
    <div className="space-y-2">
      {flag.visualUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flag.visualUrl}
          alt=""
          width={1440}
          height={900}
          className="w-full rounded-[var(--radius-inner)] border border-border/40"
        />
      ) : null}
      {hasLinks ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {pageUrls.map((pageUrl) => (
            <a
              key={pageUrl}
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm"
            >
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate max-w-[300px]">{pageUrl}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function claimNextFromHref(href?: string): string | undefined {
  if (!href) return undefined
  try {
    return new URL(href, 'https://fixflags.local').searchParams.get('next') ?? undefined
  } catch {
    return undefined
  }
}

function GatedFixPromptRow({ onClaim }: { onClaim: () => void }) {
  return (
    <div className="flex min-h-11 overflow-hidden rounded-[var(--radius-inner)] border border-border/45 bg-background shadow-sm">
      <button
        type="button"
        onClick={onClaim}
        className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 whitespace-nowrap px-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring sm:px-4"
      >
        {REPORT_COPY.explorer.fixPrompt}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      <PromptCopyButton
        prompt=""
        onLockedAction={onClaim}
        compact
        variant="brand"
        className="shrink-0 rounded-none border-0 px-3 shadow-none sm:px-4"
      />
    </div>
  )
}

export function FlagDetailPanel({
  flag,
  showFeedback = false,
  aiLocked = false,
  aiEnhancementPending = false,
  signUpHref,
  previewMeta,
  ownerActionContext,
}: {
  flag: ExplorerFlag
  showFeedback?: boolean
  aiLocked?: boolean
  aiEnhancementPending?: boolean
  signUpHref?: string
  previewMeta?: PreviewMeta | null
  ownerActionContext?: ReportOwnerActionContext
}) {
  const [claimOpen, setClaimOpen] = useState(false)
  const showShareablePreview = isShareableCheck(flag.checkId) && previewMeta
  const consequence = flag.whyItMatters.trim()

  return (
    <div key={flag.id} className="space-y-3 animate-soft-reveal" aria-live="polite">
      {flag.evidence ? (
        <div className="rounded-[var(--radius-inner)] border border-border/40 bg-muted/15 px-4 py-3">
          <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">What this means</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground text-pretty">
            {flag.evidence}{consequence && consequence !== flag.evidence ? ` ${consequence}` : ''}
          </p>
        </div>
      ) : null}

      {showShareablePreview && (
        <InlineSocialPreview preview={previewMeta!} checkId={flag.checkId} />
      )}

      <FlagEvidenceMeta flag={flag} />

      {(flag.hasFixPrompt || aiLocked || flag.copyFixPrompt) && (
        <section className="space-y-2.5">
          {aiLocked ? (
            <GatedFixPromptRow onClaim={() => setClaimOpen(true)} />
          ) : aiEnhancementPending && !flag.fixPrompt ? (
            <p className="text-sm text-muted-foreground">Generating enhanced fix prompt.</p>
          ) : flag.hasFixPrompt ? (
            <div className="flex min-h-11 overflow-hidden rounded-[var(--radius-inner)] border border-border/45 bg-background shadow-sm">
              <details className="group min-w-0 flex-1">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 whitespace-nowrap px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring sm:px-4 [&::-webkit-details-marker]:hidden">{REPORT_COPY.explorer.fixPrompt}<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden /></summary>
                <div className="border-t border-border/40 bg-muted/15">
                  <FixPromptBlock prompt={flag.fixPrompt} copyPrompt={flag.copyFixPrompt || undefined} render="markdown" markdownChrome="flat" hideActions />
                </div>
              </details>
              <PromptCopyButton prompt={flag.copyFixPrompt || flag.fixPrompt} auditId={ownerActionContext?.auditId} flagId={flag.id} surface={ownerActionContext?.surface} accessState={ownerActionContext?.accessState} compact variant="brand" className="shrink-0 rounded-none border-0 px-3 shadow-none sm:px-4" />
            </div>
          ) : flag.copyFixPrompt ? (
            <PromptCopyButton prompt={flag.copyFixPrompt} compact />
          ) : null}
        </section>
      )}

      {showFeedback && <FlagFeedback flagId={flag.id} canDismiss />}

      <ReportClaimDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        nextPath={claimNextFromHref(signUpHref)}
        from="report"
      />
    </div>
  )
}

export function FlagMetaPills({ flag }: { flag: ExplorerFlag }) {
  const impactLabel = impactTagLabel(flag.impactTag)
  const ImpactIcon = impactTagIcon(flag.impactTag)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SeveritySignal severity={flag.severity} className="h-4 w-4" />
      {flag.severity !== 'CRITICAL' ? (
        <span className="text-2xs font-medium text-muted-foreground">
          {flag.severityLabel}
        </span>
      ) : null}
      <RubricPill rubric={flag.rubric} label={flag.rubricLabel} />
      {impactLabel && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-2xs text-muted-foreground">
          {ImpactIcon && <ImpactIcon className="h-3 w-3 shrink-0" aria-hidden />}
          {impactLabel}
        </span>
      )}
    </div>
  )
}
