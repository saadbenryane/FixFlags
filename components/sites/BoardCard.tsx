'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import {
  Activity,
  Accessibility,
  Flag,
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
  boardCardHeaderText,
  boardCardSignalLabel,
  formatBoardSources,
  visibleFlagChips,
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

function FlagChips({ flags }: { flags: BoardCardFlag[] }) {
  const { shown, overflow } = visibleFlagChips(flags)
  if (shown.length === 0) return null
  return (
    <span className={styles.flags}>
      {shown.map((flag) => {
        const className = styles.flagChip
        const inner = (
          <>
            <Flag size={11} aria-hidden="true" />
            <span>{flag.title}</span>
          </>
        )
        const external = flag.href.startsWith('#') || flag.href.startsWith('http')
        if (external) {
          return (
            <a
              key={flag.id}
              className={className}
              href={flag.href}
              onClick={(event) => event.stopPropagation()}
            >
              {inner}
            </a>
          )
        }
        return (
          <Link
            key={flag.id}
            className={className}
            href={flag.href as Route}
            onClick={(event) => event.stopPropagation()}
          >
            {inner}
          </Link>
        )
      })}
      {overflow > 0 ? <span className={styles.flagMore}>+{overflow}</span> : null}
    </span>
  )
}

export function BoardCard({
  name,
  state,
  answer,
  detail,
  footer,
  visual,
  crop,
  outcome,
  action,
  href,
  wide,
  activity,
  icon: Icon,
  chart,
  onOpen,
  metric,
  flags,
  sources,
  checkedAt,
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
  flags?: BoardCardFlag[] | null
  sources?: string[] | null
  checkedAt?: string | null
}) {
  const checking = activity === 'checking' || state === 'checking'
  const className = [
    styles.card,
    wide ? styles.wide : '',
    state === 'problem' ? styles.problem : '',
    checking ? styles.checking : '',
  ]
    .filter(Boolean)
    .join(' ')

  const hideAnswer = Boolean(visual)
  const headerText = boardCardHeaderText(state, activity, checkedAt ?? null)
  const signalLabel = boardCardSignalLabel(state, activity, checkedAt ?? null)
  const sourceLine = sources && sources.length > 0 ? formatBoardSources(sources) : null
  const footerText = sourceLine && footer ? `${sourceLine} · ${footer}` : sourceLine ?? footer ?? null
  const openLabel = action ?? `Open ${name}`

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
      {hideAnswer ? null : <strong className={metric ? styles.metric : styles.answer}>{answer}</strong>}
      {detail ? <span className={styles.detail}>{detail}</span> : null}
      {outcome ? <span className={styles.outcome}>{outcome}</span> : null}
      {crop ? (
        <CardMedia
          src={crop.src}
          alt={crop.alt}
          className={styles.crop}
          sizes="(max-width: 767px) calc(100vw - 88px), 280px"
          objectPosition="center 70%"
        />
      ) : null}
      {chart === 'bars' ? (
        <span className={styles.bars} aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      ) : null}
      {footerText ? <span className={styles.footer}>{footerText}</span> : null}
      {onOpen || href ? (
        <span className={styles.action}>
          {openLabel}
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
      <span className={styles.headerEnd}>
        <FlagChips flags={flags ?? []} />
        <span
          className={[
            styles.signal,
            SIGNAL_CLASS[state],
            checking ? styles.checkingDot : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label={signalLabel}
        >
          <i aria-hidden="true" />
          {headerText ? <span>{headerText}</span> : null}
        </span>
      </span>
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
  const siteFooter =
    card.id === 'site'
      ? [card.detail, card.openFlagCount > 0 ? `${card.openFlagCount} Flag${card.openFlagCount === 1 ? '' : 's'}` : null]
          .filter(Boolean)
          .join(' · ') || null
      : null

  return (
    <BoardCard
      name={card.name}
      status={card.status}
      state={card.state}
      answer={card.answer}
      detail={problem ? problem.body : card.detail}
      footer={siteFooter}
      visual={card.captureUrl && card.captureAlt ? { src: card.captureUrl, alt: card.captureAlt } : null}
      crop={card.cropUrl && card.cropAlt ? { src: card.cropUrl, alt: card.cropAlt } : null}
      outcome={problem?.outcomeName}
      action={problem ? SITE_BOARD_COPY.openFlag : undefined}
      wide={card.wide}
      activity={card.activity}
      icon={Icon}
      onOpen={onOpen}
      flags={card.flagChips}
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
