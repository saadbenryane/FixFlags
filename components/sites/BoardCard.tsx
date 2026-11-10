'use client'

import { useId } from 'react'
import { InteractiveButton } from '@/components/ui/interactive-controls'
import { SiteFlagTarget } from './SiteFlagTarget'
import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import {
  Activity,
  Accessibility,
  Gauge,
  Globe2,
  Radio,
  Search,
  ShieldCheck,
  Target,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import { type CardHealthState, type SiteCardArea } from '@/lib/sites/card-areas'
import {
  boardFindingTitle,
  type BoardCardFlagChip,
  type BoardCardView,
} from '@/lib/sites/board-card'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { flagCountLabel } from '@/lib/sites/presentation'
import styles from './BoardCard.module.css'

export const BOARD_CARD_ICONS: Record<SiteCardArea, LucideIcon> = {
  site: Globe2,
  security: ShieldCheck,
  search: Search,
  performance: Gauge,
  conversion: Target,
  tracking: Radio,
  uptime: Activity,
  accessibility: Accessibility,
}

const SIGNAL_CLASS: Record<CardHealthState, string> = {
  healthy: styles.healthy,
  attention: styles.attention,
  problem: styles.problemSignal,
  checking: styles.checkingSignal,
  unknown: styles.unknown,
}

export type BoardCardFlag = BoardCardFlagChip & { onOpen?: () => void; copyAction?: React.ReactNode }

function CardMedia({
  src,
  alt,
  className,
  sizes,
  objectPosition,
}: {
  src: string
  alt: string
  className: string
  sizes: string
  objectPosition: string
}) {
  const marketing = src.startsWith('/marketing/')
  if (marketing) {
    return (
      <span className={className}>
        <Image src={src} alt={alt} fill sizes={sizes} style={{ objectPosition }} />
      </span>
    )
  }
  return (
    <span className={className}>
      {/* Authenticated screenshot bytes cannot go through next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={1280} height={720} loading="lazy" decoding="async" draggable={false} />
    </span>
  )
}

export type { BoardSummaryItem } from '@/lib/sites/board-types'
import type { BoardSummaryItem } from '@/lib/sites/board-types'

export function BoardSummaryStrip({ items, label = 'Website status summary', onSelect }: { items: readonly BoardSummaryItem[]; label?: string; onSelect?: (item: BoardSummaryItem) => void }) {
  return <div role="group" aria-label={label} className={styles.summaryGroup}>
    <dl className={styles.summaryStrip}>
      {items.map(item => <div key={item.id ?? item.label} className={`${styles.summaryItem} ${styles[`summary-${item.state}`]} ${item.id === 'monitoring' ? styles.summaryMonitoring : item.id === 'pages' ? styles.summaryPages : ''}`}>
        <dt>{item.label}</dt>
        <dd>{item.value}{onSelect && item.interactive !== false && <InteractiveButton type="button" className={styles.summaryAction} aria-label={`${item.value} ${item.label}${item.detail ? `. ${item.accessibleDetail ?? item.detail}` : ''}`} onClick={() => onSelect(item)} />}</dd>
        {item.detail ? <dd className={styles.summaryDetail}>{item.detail}</dd> : null}
      </div>)}
    </dl>
  </div>
}

export function BoardGrid({ children, className, layout = 'grid' }: { children: React.ReactNode; className?: string; layout?: 'grid' | 'rows' }) {
  return <div className={`${styles.grid} ${layout === 'rows' ? styles.rowGrid : ''} ${className ?? ''}`.trim()}>{children}</div>
}

export function BoardStatus({ state, label, text = label, count = 0, onOpen, showText = false }: {
  state: CardHealthState; label: string; text?: string; count?: number; onOpen?: (trigger: HTMLElement) => void; showText?: boolean
}) {
  const content = <>{count > 0 ? <><span className={styles.flagCount}>{count} {count === 1 ? 'Flag' : 'Flags'}</span>{state === 'checking' ? <span className={styles.statusText}>{text}</span> : null}</> : state === 'unknown' || state === 'checking' || showText ? <span className={styles.statusText}>{text}</span> : <span className="sr-only">{label}</span>}<i aria-hidden="true" /></>
  const className = `${styles.signal} ${SIGNAL_CLASS[state]} ${state === 'checking' ? styles.checkingDot : ''}`
  return onOpen
    ? <InteractiveButton type="button" className={`${className} ${styles.statusButton}`} onClick={event => onOpen(event.currentTarget)} aria-label={label} title={label}>{content}</InteractiveButton>
    : <span className={className} title={label}>{content}</span>
}

export function BoardCard({
  name,
  status,
  state,
  answer,
  detail,
  footer,
  visual,
  action,
  href,
  wide,
  activity,
  icon,
  onOpen,
  onOpenFlag,
  metric,
  flags,
  flagCount,
  incompleteReason,
  recoveryAction,
  compact = false,
  showFlagPreview = false,
  layout = 'card',
}: {
  name: string
  status: string
  state: CardHealthState
  answer: string
  detail?: string | null
  footer?: string | null
  visual?: { src: string; alt: string } | null
  crop?: { src: string; alt: string } | null
  outcome?: string | null
  action?: string | null
  href?: string | null
  wide?: boolean
  activity?: 'checking' | null
  icon: SiteCardArea
  chart?: 'bars' | 'none'
  onOpen?: (trigger: HTMLElement) => void
  onOpenFlag?: (id: string, trigger?: HTMLElement) => void
  metric?: boolean
  flagCount?: number
  incompleteReason?: string | null
  recoveryAction?: React.ReactNode
  compact?: boolean
  showFlagPreview?: boolean
  layout?: 'card' | 'row'
  flags?: BoardCardFlag[] | null
  sources?: string[] | null
  checkedAt?: string | null
  freshness?: string | null
}) {
  const Icon = BOARD_CARD_ICONS[icon]
  const statusId = useId()
  const checking = activity === 'checking' || state === 'checking'
  const className = [
    styles.card,
    compact ? styles.compact : '',
    wide ? styles.wide : '',
    visual ? styles.withVisual : '',
    showFlagPreview ? styles.flagPreviewCard : '',
    showFlagPreview && (state === 'attention' || state === 'problem') ? styles.flagPreviewOpen : '',
    showFlagPreview && state === 'healthy' ? styles.flagPreviewClear : '',
    compact && layout === 'card' && state === 'healthy' && !checking && !incompleteReason ? styles.healthyCard : '',
  ]
    .filter(Boolean)
    .join(' ')

  const count = flagCount ?? flags?.length ?? 0
  const signalLabel = showFlagPreview && state === 'healthy' && !checking ? status : state === 'healthy' && !checking ? flagCountLabel(count) : status
  const footerLabel = state === 'unknown' || checking ? status : count > 0 ? flagCountLabel(count) : state === 'healthy' ? flagCountLabel(0) : status
  const openLabel = action ?? SITE_BOARD_COPY.viewDetails
  const previewFlags = flags ?? []
  const visiblePreviewFlags = previewFlags.length > 3 ? previewFlags.slice(0, 2) : previewFlags.slice(0, 3)
  const hiddenPreviewCount = Math.max(0, previewFlags.length - visiblePreviewFlags.length)
  const cardFooter = footer ?? null

  if (layout === 'row') {
    const clear = state === 'healthy' && count === 0 && !checking && !incompleteReason
    const rowClassName = `${styles.boardRow} ${count > 0 ? styles.rowProblem : ''} ${clear ? styles.rowClear : ''} ${checking ? styles.rowChecking : ''}`
    const iconClass = count > 0 ? styles.iconAttention : clear ? styles.iconHealthy : undefined
    const repeatedLimit = Boolean(answer) && (footerLabel === answer || footerLabel === SITE_BOARD_COPY.siteCoverageIncomplete)
    const visibleStatus = state === 'unknown' && !checking && repeatedLimit ? '' : footerLabel
    const statusLabel = `${name}: ${checking && count > 0 ? `${flagCountLabel(count)}. ` : ''}${visibleStatus || answer}`
    const recoveryText = incompleteReason && incompleteReason !== SITE_BOARD_COPY.cardCheckIncomplete && (previewFlags.length > 0 || (incompleteReason !== answer && incompleteReason !== detail)) ? incompleteReason : null
    const rowMeta = <span className={styles.rowTrailing}>
      <span className={styles.rowStatus}>{visibleStatus || count > 0 ? <BoardStatus state={checking ? 'checking' : state} label={statusLabel} text={visibleStatus} count={count > 0 ? count : 0} onOpen={count > 0 ? onOpen : undefined} showText /> : null}</span>
    </span>
    const recovery = (recoveryText || recoveryAction) && !checking ? <div className={styles.rowRecovery}>
      {recoveryText ? <p>{recoveryText}</p> : null}
      {recoveryAction ? <span className={styles.rowRecheck}>{recoveryAction}</span> : null}
    </div> : null
    if (previewFlags.length > 0) {
      const bounded = compact && Boolean(onOpen || href)
      const rowFlags = bounded ? visiblePreviewFlags : previewFlags
      return <article className={`${rowClassName} ${styles.rowWithFlags}`} aria-label={name}>
        {onOpen ? <InteractiveButton type="button" className={styles.rowTitleButton} onClick={event => onOpen(event.currentTarget)} aria-label={`Open ${name}`}><Icon className={iconClass} size={18} aria-hidden="true" />{name}</InteractiveButton>
          : <span className={styles.rowTitle}><Icon className={iconClass} size={18} aria-hidden="true" />{name}</span>}
        {rowMeta}
        <ul className={styles.rowFlagList}>
          {rowFlags.map(flag => {
            const guidance = flag.repairGuidance === 'pending' || flag.repairGuidance === 'unavailable' ? SITE_ACTION_COPY.repairGuidance.label[flag.repairGuidance] : null
            const content = <><span className={styles.rowFlagTitle}><strong>{flag.title}</strong>{flag.priorityBand ? <small className={styles.priority} data-priority={flag.priorityBand}>{SITE_DASHBOARD_COPY.priority[flag.priorityBand]}</small> : null}{guidance ? <span className={styles.rowFlagGuidance}>{guidance}</span> : null}</span><ArrowRight size={16} aria-hidden /></>
            return <li key={flag.id}>
            <SiteFlagTarget className={styles.rowFlagName} href={flag.href} aria-label={`Open ${flag.title}`} onOpen={onOpenFlag || flag.onOpen ? trigger => { if (onOpenFlag) onOpenFlag(flag.id, trigger); else flag.onOpen?.() } : undefined}>{content}</SiteFlagTarget>
            {flag.copyAction ? <span className={styles.rowFlagActions}><span className={styles.rowCopyAction}>{flag.copyAction}</span></span> : null}
          </li> })}
          {bounded && hiddenPreviewCount > 0 ? <li>{onOpen
            ? <InteractiveButton type="button" className={styles.rowMoreAction} onClick={event => onOpen(event.currentTarget)}>{SITE_DASHBOARD_COPY.moreFlags(hiddenPreviewCount)}</InteractiveButton>
            : <Link className={styles.rowMoreAction} href={href as Route}>{SITE_DASHBOARD_COPY.moreFlags(hiddenPreviewCount)}</Link>}</li> : null}
        </ul>
        {recovery}
      </article>
    }
    const resultContent = <>
      <span className={styles.rowResultCopy}>
        <strong>{answer}</strong>
        {detail && detail !== answer ? <span>{detail}</span> : null}
      </span>
      {(href || onOpen) ? <span className={styles.rowArrow}><ArrowRight size={17} aria-hidden="true" /></span> : null}
    </>
    return <article className={rowClassName} aria-label={name}>
      {onOpen ? <InteractiveButton type="button" className={styles.rowTitleButton} onClick={event => onOpen(event.currentTarget)} aria-label={`Open ${name}`}><Icon className={iconClass} size={18} aria-hidden="true" />{name}</InteractiveButton>
        : href ? <Link className={styles.rowTitleButton} href={href as Route} aria-label={`Open ${name}`}><Icon className={iconClass} size={18} aria-hidden="true" />{name}</Link>
          : <span className={styles.rowTitle}><Icon className={iconClass} size={18} aria-hidden="true" />{name}</span>}
      {rowMeta}
      {clear ? null : href && !onOpen ? href.startsWith('#') || href.startsWith('http')
        ? <a className={styles.rowResultAction} href={href} aria-label={`View ${name} details`}>{resultContent}</a>
        : <Link className={styles.rowResultAction} href={href as Route} aria-label={`View ${name} details`}>{resultContent}</Link>
        : onOpen ? <InteractiveButton type="button" className={styles.rowResultAction} onClick={event => onOpen(event.currentTarget)} aria-label={`View ${name} details`}>{resultContent}</InteractiveButton>
          : <span className={styles.rowResultAction}>{resultContent}</span>}
      {recovery}
    </article>
  }

  if (compact && count === 0) {
    // While a check runs, describe only the running work. The previous result's
    // gaps belong to that result, not to the check in progress.
    const description = [...new Set((checking ? [status ?? SITE_BOARD_COPY.checking, detail]
      : [status, incompleteReason, answer !== flagCountLabel(0) ? answer : null, detail]).filter(Boolean))].join('. ')
    const content = <><span className={styles.title}><Icon size={17} aria-hidden />{name}</span><span className={styles.clearCount}>{/* While a check runs, the header owns the status; a card shows only its spinner. */}
      {checking ? null : <span className={styles.compactStatus}>{state === 'healthy' && !incompleteReason ? flagCountLabel(0) : status}</span>}
      <span className={`${styles.signal} ${SIGNAL_CLASS[checking ? 'checking' : state]} ${checking ? styles.checkingDot : ''}`} title={description}><i aria-hidden /></span><ArrowRight size={15} aria-hidden /></span><span id={statusId} className="sr-only">{description}</span></>
    const compactClass = `${styles.card} ${styles.compactSummary}`
    return onOpen ? <InteractiveButton type="button" className={compactClass} onClick={event => onOpen(event.currentTarget)} aria-label={`Open ${name}`} aria-describedby={statusId}>{content}</InteractiveButton>
      : href ? <Link className={compactClass} href={href as Route} aria-label={`Open ${name}`} aria-describedby={statusId}>{content}</Link>
        : <article className={compactClass} aria-label={name} aria-describedby={statusId}>{content}</article>
  }

  const body = (
    <>
      {visual ? (
        <CardMedia
          src={visual.src}
          alt={visual.alt}
          className={styles.visual}
          sizes="(max-width: 767px) calc(100vw - 88px), (max-width: 1279px) calc(50vw - 64px), 720px"
          objectPosition="center top"
        />
      ) : null}
      {showFlagPreview && visiblePreviewFlags.length > 0 ? (
        <ul className={styles.flagPreviewList}>
          {visiblePreviewFlags.map(flag => {
            const content = <><span>{flag.title}{flag.priorityBand ? <small className={styles.priority} data-priority={flag.priorityBand}>{SITE_DASHBOARD_COPY.priority[flag.priorityBand]}</small> : null}</span><ArrowRight size={14} aria-hidden /></>
            return <li key={flag.id}><SiteFlagTarget className={styles.flagPreviewLink} aria-label={`Open ${flag.title}`} href={flag.href} onOpen={onOpenFlag || flag.onOpen ? trigger => { if (onOpenFlag) onOpenFlag(flag.id, trigger); else flag.onOpen?.() } : undefined}>{content}</SiteFlagTarget>{flag.copyAction ? <div className={styles.previewCopyAction}>{flag.copyAction}</div> : null}</li>
          })}
          {hiddenPreviewCount > 0 ? <li className={styles.flagPreviewMore}>+{hiddenPreviewCount} more</li> : null}
        </ul>
      ) : <strong className={metric ? styles.metric : styles.answer}>{answer}</strong>}
      {!showFlagPreview && detail ? <span className={styles.detail}>{detail}</span> : null}
      {!compact && incompleteReason ? <span className={styles.incompleteNote}>{incompleteReason}</span> : null}
      {cardFooter ? <span className={styles.footer}>{cardFooter}</span> : null}
      {href && !onOpen ? (
        <span className={styles.action}>
          <span className={compact ? 'sr-only' : undefined}>{openLabel}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </span>
      ) : null}
    </>
  )

  const header = (
    <span className={styles.header}>
      <span className={styles.title}>
        <Icon size={17} aria-hidden="true" />
        {name}
      </span>
      {(!onOpen || showFlagPreview) ? <BoardStatus state={checking ? 'checking' : state} label={`${name}: ${signalLabel}`} text={signalLabel} count={showFlagPreview ? count : 0} showText={showFlagPreview} /> : null}
    </span>
  )

  if (showFlagPreview && visiblePreviewFlags.length && (onOpen || visiblePreviewFlags.some(flag => flag.copyAction))) {
    return <div className={`${className} ${styles.cardWithLinks}`}>
      {onOpen ? <InteractiveButton type="button" className={styles.cardOpen} onClick={event => onOpen(event.currentTarget)} aria-label={`Open ${name}`} />
        : href ? <Link className={styles.cardOpen} href={href as Route} aria-label={`Open ${name}`} /> : null}
      {header}<div className={styles.body}>{body}</div>
      <span className={`${styles.cardActions} ${styles.previewActions}`} aria-hidden><span className={styles.openButton}><ArrowRight size={17} /></span></span>
    </div>
  }

  if (href && !onOpen) {
    const external = href.startsWith('#') || href.startsWith('http')
    if (external) {
      return (
        <article className={className} aria-label={name}>
          {header}
          <a className={styles.body} href={href} aria-label={name}>
            {body}
          </a>
        </article>
      )
    }
    return (
      <article className={className} aria-label={name}>
        {header}
        <Link className={styles.body} href={href as Route} aria-label={name}>
          {body}
        </Link>
      </article>
    )
  }

  if (onOpen) {
    return (
      <InteractiveButton type="button" className={className} onClick={event => onOpen(event.currentTarget)} aria-label={`Open ${name}`}>
        {header}
        <span className={styles.body}>
          {body}
        </span>
        <span className={`${styles.cardActions} ${showFlagPreview ? styles.previewActions : ''}`}>
          {!showFlagPreview ? <span className={styles.flagMeta}>
            <BoardStatus state={checking ? 'checking' : state} label={`${name}: ${footerLabel}`} text={answer === footerLabel ? '' : footerLabel} showText={answer !== footerLabel} />
          </span> : null}
          <span className={styles.openButton}>
            <ArrowRight size={17} aria-hidden="true" />
          </span>
        </span>
      </InteractiveButton>
    )
  }

  return (
    <article className={className} aria-label={name}>
      {header}
      <div className={styles.body}>{body}</div>
    </article>
  )
}

export function ProductBoardCard({
  card,
  freshness,
  onOpen,
  renderFlagCopy,
  onOpenFlag,
  recoveryAction,
  compact = false,
  layout = 'card',
}: {
  card: BoardCardView
  freshness?: string
  onOpen?: (trigger: HTMLElement) => void
  onOpenFlag?: (id: string, trigger?: HTMLElement) => void
  renderFlagCopy?: (flag: BoardCardFlagChip) => React.ReactNode
  recoveryAction?: React.ReactNode
  compact?: boolean
  layout?: 'card' | 'row'
}) {
  const problem = card.problem
  const originalAnswer = card.answer
  // Presentation-only labels for known findings. Keep the original diagnosis
  // and measured scope in card depth; never summarize unknown claims by truncation.
  const recordedPartial = compact && card.state === 'unknown' && card.activity !== 'checking'
    && Boolean(card.checkedAt && card.incompleteReason) && card.openFlagCount === 0
  const answer = recordedPartial ? SITE_BOARD_COPY.partialNoFlags : compact ? boardFindingTitle(originalAnswer) : originalAnswer

  return (
    <BoardCard
      name={card.name}
      status={recordedPartial ? SITE_ACTION_COPY.execution.partialStatus : card.status}
      state={card.state}
      answer={answer}
      detail={card.id === 'site' ? card.detail : compact ? null : problem ? problem.body : card.detail}
      compact={compact}
      showFlagPreview={compact && layout === 'card' && card.flagChips.length > 0}
      incompleteReason={card.incompleteReason}
      recoveryAction={recoveryAction}

      visual={card.captureUrl && card.captureAlt ? { src: card.captureUrl, alt: card.captureAlt } : null}
      crop={card.cropUrl && card.cropAlt ? { src: card.cropUrl, alt: card.cropAlt } : null}
      outcome={problem?.outcomeName}
      action={problem ? SITE_BOARD_COPY.openFlag : undefined}
      wide={card.wide}
      activity={card.activity}
      icon={card.id}
      onOpen={onOpen}
      onOpenFlag={onOpenFlag}
      flagCount={card.openFlagCount}
      flags={card.flagChips.map(flag => ({ ...flag, title: compact ? boardFindingTitle(flag.title) : flag.title, copyAction: renderFlagCopy?.(flag) }))}
      sources={card.sources}
      checkedAt={card.checkedAt}
      freshness={freshness}
      layout={layout}
    />
  )
}
