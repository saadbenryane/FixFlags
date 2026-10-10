'use client'

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
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
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

export type BoardCardFlag = BoardCardFlagChip

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

export function BoardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`${styles.grid} ${className ?? ''}`.trim()}>{children}</div>
}

export function BoardStatus({ state, label, text = label, count = 0, onOpen, showText = false }: {
  state: CardHealthState; label: string; text?: string; count?: number; onOpen?: () => void; showText?: boolean
}) {
  const content = <><i aria-hidden="true" />{count > 0 ? <span>{count} {count === 1 ? 'Flag' : 'Flags'}</span> : state === 'unknown' || state === 'checking' || showText ? <span>{text}</span> : <span className="sr-only">{label}</span>}</>
  const className = `${styles.signal} ${SIGNAL_CLASS[state]} ${state === 'checking' ? styles.checkingDot : ''}`
  return onOpen
    ? <button type="button" className={`${className} ${styles.statusButton}`} onClick={onOpen} aria-label={label} title={label}>{content}</button>
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
  metric,
  flags,
  flagCount,
  incompleteReason,
  compact = false,
  showFlagPreview = false,
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
  onOpen?: () => void
  metric?: boolean
  flagCount?: number
  incompleteReason?: string | null
  compact?: boolean
  showFlagPreview?: boolean
  flags?: BoardCardFlag[] | null
  sources?: string[] | null
  checkedAt?: string | null
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
          {visiblePreviewFlags.map(flag => <li key={flag.id}>{flag.title}</li>)}
          {hiddenPreviewCount > 0 ? <li className={styles.flagPreviewMore}>+{hiddenPreviewCount} more</li> : null}
        </ul>
      ) : <strong className={metric ? styles.metric : styles.answer}>{answer}</strong>}
      {!showFlagPreview && detail ? <span className={styles.detail}>{detail}</span> : null}
      {incompleteReason ? <span className={styles.incompleteNote}>{incompleteReason}</span> : null}
      {footer ? <span className={styles.footer}>{footer}</span> : null}
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

  if (onOpen) {
    return (
      <button type="button" className={className} onClick={onOpen} aria-label={`Open ${name}`}>
        {header}
        <span className={styles.body}>
          {body}
        </span>
        <span className={`${styles.cardActions} ${showFlagPreview ? styles.previewActions : ''}`}>
          {!showFlagPreview ? <span className={styles.flagMeta}>
            <BoardStatus state={checking ? 'checking' : state} label={`${name}: ${footerLabel}`} text={footerLabel} showText />
          </span> : null}
          <span className={styles.openButton}>
            <ArrowRight size={17} aria-hidden="true" />
          </span>
        </span>
      </button>
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
  onOpen,
  compact = false,
}: {
  card: BoardCardView
  onOpen?: () => void
  compact?: boolean
}) {
  const problem = card.problem
  const originalAnswer = card.answer
  // Presentation-only labels for known findings. Keep the original diagnosis
  // and measured scope in card depth; never summarize unknown claims by truncation.
  const answer = compact ? boardFindingTitle(originalAnswer) : originalAnswer

  return (
    <BoardCard
      name={card.name}
      status={card.status}
      state={card.state}
      answer={answer}
      detail={card.id === 'site' || (compact && card.evidenced && card.state !== 'unknown') ? null : problem ? problem.body : card.detail}
      compact={compact}
      incompleteReason={compact ? null : card.incompleteReason}

      visual={card.captureUrl && card.captureAlt ? { src: card.captureUrl, alt: card.captureAlt } : null}
      crop={card.cropUrl && card.cropAlt ? { src: card.cropUrl, alt: card.cropAlt } : null}
      outcome={problem?.outcomeName}
      action={problem ? SITE_BOARD_COPY.openFlag : undefined}
      wide={card.wide}
      activity={card.activity}
      icon={card.id}
      onOpen={onOpen}
      flagCount={card.openFlagCount}
      flags={card.id === 'site' ? [] : card.flagChips}
      sources={card.sources}
      checkedAt={card.checkedAt}
    />
  )
}
