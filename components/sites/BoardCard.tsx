'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import {
  Activity,
  Accessibility,
  Gauge,
  Globe2,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Target,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import { ADDABLE_BOARD_CARDS, CARD_CATALOG, type CardHealthState, type SiteCardArea } from '@/lib/sites/card-areas'
import {
  type BoardCardFlagChip,
  type BoardCardView,
} from '@/lib/sites/board-card'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
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

export function BoardGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.grid}>{children}</div>
}

export function BoardStatus({ state, label, text = label, count = 0, onOpen }: {
  state: CardHealthState; label: string; text?: string; count?: number; onOpen?: () => void
}) {
  const content = <><i aria-hidden="true" />{count > 0 ? <span>{count} {count === 1 ? 'Flag' : 'Flags'}</span> : state === 'unknown' || state === 'checking' ? <span>{text}</span> : <span className="sr-only">{label}</span>}</>
  const className = `${styles.signal} ${SIGNAL_CLASS[state]} ${state === 'checking' ? styles.checkingDot : ''}`
  return onOpen
    ? <button type="button" className={`${className} ${styles.statusButton}`} onClick={onOpen} aria-label={label} title={label}>{content}</button>
    : <span className={className} title={label}>{content}</span>
}

export function BoardSurface({ host, state, label, count, onOpen, children }: {
  host: string; state: CardHealthState; label: string; text?: string; count?: number; onOpen: () => void; children: React.ReactNode
}) {
  return <div className={styles.surface}>
    <div className={styles.surfaceHeader}><span><Globe2 size={16} aria-hidden="true" />{host}</span><BoardStatus state={state} label={label} count={count} onOpen={onOpen} /></div>
    {children}
  </div>
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
  icon: Icon,
  onOpen,
  metric,
  flags,
  flagCount,
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
  icon: LucideIcon
  chart?: 'bars' | 'none'
  onOpen?: () => void
  metric?: boolean
  flagCount?: number
  flags?: BoardCardFlag[] | null
  sources?: string[] | null
  checkedAt?: string | null
}) {
  const checking = activity === 'checking' || state === 'checking'
  const className = [
    styles.card,
    wide ? styles.wide : '',
    visual ? styles.withVisual : '',
    state === 'problem' && !visual ? styles.problem : '',
    checking ? styles.checking : '',
  ]
    .filter(Boolean)
    .join(' ')

  const signalLabel = checking ? SITE_BOARD_COPY.checking : state === 'healthy' ? '0 Flags' : status
  const openLabel = action ?? SITE_BOARD_COPY.viewDetails

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
      <strong className={metric ? styles.metric : styles.answer}>{answer}</strong>
      {detail ? <span className={styles.detail}>{detail}</span> : null}
      {footer ? <span className={styles.footer}>{footer}</span> : null}
      {onOpen || href ? (
        <span className={styles.action}>
          <span>{openLabel}</span>
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
      <BoardStatus state={checking ? 'checking' : state} label={`${name}: ${signalLabel}`} text={checking ? signalLabel : ''} count={flagCount ?? flags?.length} onOpen={onOpen} />
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
      <article className={className} aria-label={name}>
        {header}
        <button type="button" className={styles.body} onClick={onOpen} aria-label={name}>
          {body}
        </button>
      </article>
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
}: {
  card: BoardCardView
  onOpen?: () => void
}) {
  const Icon = BOARD_CARD_ICONS[card.id] ?? Globe2
  const problem = card.problem

  return (
    <BoardCard
      name={card.name}
      status={card.status}
      state={card.state}
      answer={card.id === 'site' ? card.detail ?? 'Website overview' : card.answer}
      detail={card.id === 'site' ? null : problem ? problem.body : card.detail}

      visual={card.captureUrl && card.captureAlt ? { src: card.captureUrl, alt: card.captureAlt } : null}
      crop={card.cropUrl && card.cropAlt ? { src: card.cropUrl, alt: card.cropAlt } : null}
      outcome={problem?.outcomeName}
      action={problem ? SITE_BOARD_COPY.openFlag : undefined}
      wide={card.wide}
      activity={card.activity}
      icon={Icon}
      onOpen={onOpen}
      flags={card.id === 'site' ? [] : card.flagChips}
      sources={card.sources}
      checkedAt={card.checkedAt}
    />
  )
}

export function AddBoardCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className={styles.addCard} onClick={onOpen}>
      <span className={styles.addSymbol} aria-hidden="true">
        <Plus size={22} />
      </span>
      <strong>{SITE_BOARD_COPY.addCard}</strong>
    </button>
  )
}

export function AddCardLibrary({
  open,
  onOpenChange,
  present,
  onAdd,
  exampleNote,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  present: SiteCardArea[]
  onAdd: (id: SiteCardArea) => void
  exampleNote?: string | null
}) {
  const available = ADDABLE_BOARD_CARDS.filter((id) => !present.includes(id))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{SITE_BOARD_COPY.addTitle}</DialogTitle>
        <DialogDescription>{SITE_BOARD_COPY.addBody}</DialogDescription>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">{SITE_BOARD_COPY.addEmpty}</p>
        ) : (
          <ul className={styles.libraryList}>
            {available.map((id) => {
              const Icon = BOARD_CARD_ICONS[id]
              const card = CARD_CATALOG[id]
              return (
                <li key={id}>
                  <button type="button" className={styles.libraryItem} onClick={() => onAdd(id)}>
                    <span className={styles.libraryIcon} aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong>{card.name}</strong>
                      <small>{card.question}</small>
                    </span>
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {exampleNote ? <p className="text-xs text-muted-foreground">{exampleNote}</p> : null}
      </DialogContent>
    </Dialog>
  )
}
