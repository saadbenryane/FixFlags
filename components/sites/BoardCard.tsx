'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
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
        <dd>{item.value}{onSelect && <InteractiveButton type="button" className={styles.summaryAction} aria-label={`${item.value} ${item.label}${item.detail ? `. ${item.accessibleDetail ?? item.detail}` : ''}`} onClick={() => onSelect(item)} />}</dd>
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
      {recoveryAction && !checking ? <span className={styles.rowRecheck}>{recoveryAction}</span> : null}
    </span>
    const recovery = recoveryText && !checking ? <div className={styles.rowRecovery}><p>{recoveryText}</p></div> : null
    if (previewFlags.length > 0) {
      return <article className={`${rowClassName} ${styles.rowWithFlags}`} aria-label={name}>
        {onOpen ? <InteractiveButton type="button" className={styles.rowTitleButton} onClick={event => onOpen(event.currentTarget)} aria-label={`Open ${name}`}><Icon className={iconClass} size={18} aria-hidden="true" />{name}</InteractiveButton>
          : <span className={styles.rowTitle}><Icon className={iconClass} size={18} aria-hidden="true" />{name}</span>}
        {rowMeta}
        <ul className={styles.rowFlagList}>
          {previewFlags.map(flag => {
            const guidance = flag.repairGuidance === 'pending' || flag.repairGuidance === 'unavailable' ? SITE_ACTION_COPY.repairGuidance.label[flag.repairGuidance] : null
            return <li key={flag.id}>
            {flag.onOpen ? <InteractiveButton type="button" className={styles.rowFlagName} onClick={flag.onOpen}><strong>{flag.title}</strong>{guidance ? <span className={styles.rowFlagGuidance}>{guidance}</span> : null}</InteractiveButton>
              : <Link className={styles.rowFlagName} href={flag.href as Route}><strong>{flag.title}</strong>{guidance ? <span className={styles.rowFlagGuidance}>{guidance}</span> : null}</Link>}
            <span className={styles.rowFlagActions}>{flag.copyAction ? <span className={styles.rowCopyAction}>{flag.copyAction}</span> : null}
              {flag.onOpen ? <InteractiveButton type="button" className={styles.rowFlagOpen} onClick={flag.onOpen} aria-label={`Open ${flag.title}`}><ArrowRight size={17} aria-hidden="true" /></InteractiveButton>
                : <Link className={styles.rowFlagOpen} href={flag.href as Route} aria-label={`Open ${flag.title}`}><ArrowRight size={17} aria-hidden="true" /></Link>}
            </span>
          </li> })}
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

  const clear = compact && count === 0 && state === 'healthy' && !checking && !incompleteReason
  if (clear) {
    const content = <><span className={styles.title}><Icon size={17} aria-hidden />{name}</span><span className={styles.clearCount}>{flagCountLabel(0)}<ArrowRight size={15} aria-hidden /></span></>
    const clearClass = `${styles.card} ${styles.clearSummary}`
    return onOpen ? <InteractiveButton type="button" className={clearClass} onClick={event => onOpen(event.currentTarget)} aria-label={`Open ${name}`}>{content}</InteractiveButton>
      : href ? <Link className={clearClass} href={href as Route} aria-label={`Open ${name}`}>{content}</Link>
        : <article className={clearClass} aria-label={name}>{content}</article>
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
            return <li key={flag.id}>{onOpenFlag || flag.onOpen
              ? <InteractiveButton type="button" className={styles.flagPreviewLink} aria-label={`Open ${flag.title}`} onClick={event => { if (onOpenFlag) onOpenFlag(flag.id, event.currentTarget); else flag.onOpen?.() }}>{content}</InteractiveButton>
              : <Link className={styles.flagPreviewLink} aria-label={`Open ${flag.title}`} href={flag.href as Route}>{content}</Link>}</li>
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

  if (onOpen && showFlagPreview && visiblePreviewFlags.length) {
    return <div className={`${className} ${styles.cardWithLinks}`}>
      <InteractiveButton type="button" className={styles.cardOpen} onClick={event => onOpen(event.currentTarget)} aria-label={`Open ${name}`} />
      {header}<div className={styles.body}>{body}</div>
      <span className={`${styles.cardActions} ${styles.previewActions}`} aria-hidden><span className={styles.openButton}><ArrowRight size={17} /></span></span>
    </div>
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
  const answer = recordedPartial ? flagCountLabel(0) : compact ? boardFindingTitle(originalAnswer) : originalAnswer

  return (
    <BoardCard
      name={card.name}
      status={recordedPartial && layout === 'card' ? SITE_DASHBOARD_COPY.checkDetails : recordedPartial ? SITE_ACTION_COPY.execution.partialStatus : card.status}
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
