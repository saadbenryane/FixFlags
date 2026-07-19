'use client'

import type { ReactNode } from 'react'
import { ClipboardCheck, ExternalLink, Lightbulb, ScanSearch, Share2, Sparkles, type LucideIcon } from 'lucide-react'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { FlagFeedback } from '@/components/audit/FlagFeedback'
import { LockedContentTeaser } from '@/components/audit/LockedContentTeaser'
import { SeverityBadge } from '@/components/audit/SeverityBadge'
import { RubricPill } from '@/components/marketing/sample/RubricDimensionHeader'
import type { ExplorerFlag } from '@/lib/report/explorer-model'
import type { PreviewMeta } from '@/lib/audit/preview-meta'
import { displayHostname, truncatePreview } from '@/lib/audit/preview-meta'
import { cn, impactTagIcon, impactTagLabel } from '@/lib/utils'

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
            loading="lazy"
            className="aspect-[1.91/1] w-full bg-muted object-cover"
          />
        ) : hasImage && !imageOk ? (
          <div className="flex aspect-[1.91/1] w-full flex-col items-center justify-center gap-1 bg-muted px-4 text-center text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Image URL is broken</span>
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
  emphasis = false,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
  emphasis?: boolean
}) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-inner)] border p-4 sm:p-5',
        emphasis ? 'border-brand/20 bg-brand/5' : 'border-border/40 bg-muted/15'
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', emphasis ? 'text-brand' : 'text-muted-foreground')} aria-hidden />
        <h4 className={cn('text-sm font-medium', emphasis ? 'text-brand' : 'text-foreground')}>{title}</h4>
      </div>
      {children}
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
}: {
  flag: ExplorerFlag
  showFeedback?: boolean
  aiLocked?: boolean
  aiEnhancementPending?: boolean
  signUpHref?: string
  previewMeta?: PreviewMeta | null
}) {
  const showShareablePreview = isShareableCheck(flag.checkId) && previewMeta

  return (
    <div key={flag.id} className="space-y-3 animate-soft-reveal" aria-live="polite">
      {showShareablePreview && (
        <InlineSocialPreview preview={previewMeta!} checkId={flag.checkId} />
      )}

      {flag.evidence && (
        <FlagCard title="Evidence" icon={ScanSearch}>
          <p className="text-sm leading-relaxed text-foreground/90 text-pretty">{flag.evidence}</p>
          {flag.pageUrl ? (
            <a
              href={flag.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate max-w-[300px]">{flag.pageUrl}</span>
            </a>
          ) : null}
        </FlagCard>
      )}

      {flag.whyItMatters && (
        <FlagCard title="Why it matters" icon={Lightbulb}>
          <p className="text-sm leading-relaxed text-foreground/90 text-pretty">{flag.whyItMatters}</p>
        </FlagCard>
      )}

      {flag.verificationRule && (
        <FlagCard title="How to verify" icon={ClipboardCheck}>
          <p className="text-sm leading-relaxed text-foreground/90 text-pretty">
            {flag.verificationRule}
          </p>
        </FlagCard>
      )}

      {(flag.hasFixPrompt || aiLocked) && (
        <FlagCard title="Fix" icon={Sparkles} emphasis>
          {aiLocked ? (
            <LockedContentTeaser
              label="Create a free account to get the fix prompt for this flag"
              signUpHref={signUpHref}
            />
          ) : aiEnhancementPending && !flag.fixPrompt ? (
            <p className="text-sm text-muted-foreground">
              Generating enhanced fix prompt. Deterministic guidance is in the evidence above.
            </p>
          ) : (
            <FixPromptBlock
              prompt={flag.fixPrompt}
              toolPrompts={flag.toolPrompts}
              showToolSelector
              clamp={false}
              showCursorAction
              variant="compact"
              nested
            />
          )}
        </FlagCard>
      )}

      {showFeedback && <FlagFeedback flagId={flag.id} canDismiss />}
    </div>
  )
}

export function FlagMetaPills({ flag }: { flag: ExplorerFlag }) {
  const impactLabel = impactTagLabel(flag.impactTag)
  const ImpactIcon = impactTagIcon(flag.impactTag)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RubricPill rubric={flag.rubric} label={flag.rubricLabel} />
      <SeverityBadge severity={flag.severity} />
      {impactLabel && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-2xs text-muted-foreground">
          {ImpactIcon && <ImpactIcon className="h-3 w-3 shrink-0" aria-hidden />}
          {impactLabel}
        </span>
      )}
    </div>
  )
}
