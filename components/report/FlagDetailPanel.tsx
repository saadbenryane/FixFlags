'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, Link2, Share2, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { ReportClaimDialog } from '@/components/auth/ReportClaimDialog'
import { useReportAuthGate } from '@/components/auth/ReportAuthGate'
import { FlagFeedback } from '@/components/audit/FlagFeedback'
import { RubricPill } from '@/components/marketing/sample/RubricDimensionHeader'
import { SeveritySignal } from '@/components/report/SeveritySignal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ExplorerFlag } from '@/lib/report/explorer-model'
import type { PreviewMeta } from '@/lib/audit/preview-meta'
import { displayHostname, truncatePreview } from '@/lib/audit/preview-meta'
import { impactTagIcon } from '@/lib/rubric-icons'
import { impactTagLabel, cn } from '@/lib/utils'
import { reviewPathLabel } from '@/lib/audit/url-identity'
import { trackEvent, type ReportAccessState, type ReportSurface } from '@/lib/analytics/events'
import { isUsableFixPrompt } from '@/lib/audit/priority-flags'

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

function claimNextFromHref(href?: string): string | undefined {
  if (!href) return undefined
  try {
    return new URL(href, 'https://fixflags.local').searchParams.get('next') ?? undefined
  } catch {
    return undefined
  }
}

export function flagHasPromptChrome(
  flag: ExplorerFlag,
  options: { aiLocked?: boolean; aiEnhancementPending?: boolean } = {},
) {
  return Boolean(
    flag.hasFixPrompt ||
      options.aiLocked ||
      flag.copyFixPrompt ||
      (options.aiEnhancementPending && !flag.fixPrompt),
  )
}

const PROMPT_COPY_CLASS =
  'h-11 shrink-0 rounded-none border-0 px-3 shadow-none sm:px-4'

const PROMPT_SPLIT_CHEVRON_CLASS =
  'flex h-11 w-9 shrink-0 items-center justify-center border-l border-brand-foreground/25 bg-brand text-brand-foreground transition-colors hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring disabled:opacity-50'

export function FlagPromptRow({
  flag,
  aiLocked = false,
  aiEnhancementPending = false,
  signUpHref,
  ownerActionContext,
  polishPassPrompt = null,
  aggregateLocked = false,
}: {
  flag: ExplorerFlag
  aiLocked?: boolean
  aiEnhancementPending?: boolean
  signUpHref?: string
  ownerActionContext?: ReportOwnerActionContext
  /** Aggregate Finish Plan prompt for Copy all. */
  polishPassPrompt?: string | null
  /** Report-level gate for Copy all (independent of the demonstrated Flag unlock). */
  aggregateLocked?: boolean
}) {
  const [claimOpen, setClaimOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const authGate = useReportAuthGate()

  function openClaim() {
    if (authGate) {
      authGate.open({
        nextPath: claimNextFromHref(signUpHref),
        auditId: ownerActionContext?.auditId,
      })
      return
    }
    setClaimOpen(true)
  }

  if (!flagHasPromptChrome(flag, { aiLocked, aiEnhancementPending })) {
    return null
  }

  const showCopyAll = Boolean(polishPassPrompt) || aggregateLocked
  const canViewPrompt = Boolean(flag.hasFixPrompt && flag.fixPrompt && !aiLocked)

  async function copyAllPrompts() {
    if (aggregateLocked) {
      openClaim()
      return
    }
    const safePrompt = isUsableFixPrompt(polishPassPrompt ?? '') ? polishPassPrompt!.trim() : null
    if (!safePrompt) return
    await navigator.clipboard.writeText(safePrompt)
    trackEvent('fix_prompt_copied', {
      kind: 'plan',
      audit_id: ownerActionContext?.auditId,
      surface: ownerActionContext?.surface,
      access_state: ownerActionContext?.accessState,
    })
    trackEvent('polish_pass_copied', {
      audit_id: ownerActionContext?.auditId,
      surface: ownerActionContext?.surface,
      access_state: ownerActionContext?.accessState,
    })
    toast.success(REPORT_COPY.explorer.promptCopied)
  }

  const copyAllMenu = showCopyAll ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={REPORT_COPY.finishPlan.copyCta}
          className={PROMPT_SPLIT_CHEVRON_CLASS}
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => { void copyAllPrompts() }}>
          {REPORT_COPY.finishPlan.copyCta}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  let row: ReactNode
  if (aiEnhancementPending && !flag.fixPrompt && !aiLocked) {
    row = (
      <p className="px-1 text-sm text-muted-foreground">Generating enhanced fix prompt.</p>
    )
  } else if (aiLocked || flag.hasFixPrompt) {
    row = (
      <div className="space-y-2">
        <div className="flex items-stretch overflow-hidden rounded-[var(--radius-inner)] border border-border/45 bg-background shadow-sm">
          <button
            type="button"
            aria-expanded={canViewPrompt ? promptOpen : undefined}
            onClick={() => {
              if (aiLocked) {
                openClaim()
                return
              }
              if (canViewPrompt) setPromptOpen((open) => !open)
            }}
            className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 whitespace-nowrap px-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring sm:px-4"
          >
            {REPORT_COPY.explorer.fixPrompt}
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                promptOpen && canViewPrompt && 'rotate-180'
              )}
              aria-hidden
            />
          </button>
          <div className="flex shrink-0 items-stretch">
            <PromptCopyButton
              prompt={aiLocked ? '' : flag.copyFixPrompt || flag.fixPrompt}
              onLockedAction={aiLocked ? openClaim : undefined}
              auditId={ownerActionContext?.auditId}
              flagId={flag.id}
              surface={ownerActionContext?.surface}
              accessState={ownerActionContext?.accessState}
              compact
              variant="brand"
              className={PROMPT_COPY_CLASS}
            />
            {copyAllMenu}
          </div>
        </div>
        {promptOpen && canViewPrompt ? (
          <div className="max-h-44 overflow-y-auto rounded-[var(--radius-inner)] border border-border/40 bg-muted/15 scrollbar-thin">
            <FixPromptBlock
              prompt={flag.fixPrompt}
              copyPrompt={flag.copyFixPrompt || undefined}
              render="markdown"
              markdownChrome="flat"
              hideActions
            />
          </div>
        ) : null}
      </div>
    )
  } else {
    row = <PromptCopyButton prompt={flag.copyFixPrompt} compact />
  }

  return (
    <section data-flag-prompt-row className="min-w-0">
      {row}
      <ReportClaimDialog
        open={authGate ? false : claimOpen}
        onOpenChange={setClaimOpen}
        nextPath={claimNextFromHref(signUpHref)}
        from="report"
        reason="save-report"
      />
    </section>
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
  evidencePair,
  hidePromptRow = false,
  polishPassPrompt = null,
  aggregateLocked = false,
}: {
  flag: ExplorerFlag
  showFeedback?: boolean
  aiLocked?: boolean
  aiEnhancementPending?: boolean
  signUpHref?: string
  previewMeta?: PreviewMeta | null
  ownerActionContext?: ReportOwnerActionContext
  evidencePair?: ReactNode
  hidePromptRow?: boolean
  polishPassPrompt?: string | null
  aggregateLocked?: boolean
}) {
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

      {hidePromptRow ? null : (
        <FlagPromptRow
          flag={flag}
          aiLocked={aiLocked}
          aiEnhancementPending={aiEnhancementPending}
          signUpHref={signUpHref}
          ownerActionContext={ownerActionContext}
          polishPassPrompt={polishPassPrompt}
          aggregateLocked={aggregateLocked}
        />
      )}

      {evidencePair}

      {showFeedback && <FlagFeedback flagId={flag.id} canDismiss />}
    </div>
  )
}

function FlagPagesPill({ flag }: { flag: ExplorerFlag }) {
  const [open, setOpen] = useState(false)
  const pageUrls = flag.pageUrls.length > 0 ? flag.pageUrls : flag.pageUrl ? [flag.pageUrl] : []
  if (pageUrls.length === 0) return null
  const count = Math.max(pageUrls.length, flag.occurrenceCount ?? 0, 1)
  const label =
    count === 1
      ? REPORT_COPY.explorer.onPath(reviewPathLabel(pageUrls[0]!))
      : REPORT_COPY.explorer.onPages(count)

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex min-h-8 items-center gap-1 rounded-full bg-muted/50 px-2.5 py-1 text-2xs font-medium tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Link2 className="h-3 w-3 shrink-0" aria-hidden />
            {count}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-xs space-y-1.5 px-3 py-2 text-xs"
          onPointerDownOutside={() => setOpen(false)}
        >
          <ul className="space-y-1">
            {pageUrls.map((pageUrl) => (
              <li key={pageUrl}>
                <a
                  href={pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-link hover:text-link-hover hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {REPORT_COPY.explorer.onPath(reviewPathLabel(pageUrl))}
                </a>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
      <FlagPagesPill flag={flag} />
    </div>
  )
}
