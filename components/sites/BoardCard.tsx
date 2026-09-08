'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import {
  Activity,
  Gauge,
  Globe2,
  Radio,
  Search,
  ShieldCheck,
  Target,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import type { CardHealthState, SiteCardArea } from '@/lib/sites/card-areas'
import type { BoardCardView } from '@/lib/sites/board-card'
import styles from './BoardCard.module.css'

export const BOARD_CARD_ICONS: Record<SiteCardArea, LucideIcon> = {
  site: Globe2,
  security: ShieldCheck,
  search: Search,
  performance: Gauge,
  conversion: Target,
  tracking: Radio,
  uptime: Activity,
  accessibility: Globe2,
}

const SIGNAL_CLASS: Record<CardHealthState, string> = {
  healthy: styles.healthy,
  attention: styles.attention,
  problem: styles.problemSignal,
  checking: styles.checkingSignal,
  unknown: styles.unknown,
}

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
        <Image src={src} alt={alt} fill sizes={sizes} style={{ objectFit: 'cover', objectPosition }} />
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

export function BoardCard({
  name,
  status,
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

  const hideAnswer = Boolean(visual) && answer === status

  const body = (
    <>
      <span className={styles.header}>
        <Icon size={17} aria-hidden="true" />
        {name}
        <span
          className={[
            styles.signal,
            SIGNAL_CLASS[state],
            checking ? styles.checkingDot : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <i aria-hidden="true" />
          {status}
        </span>
      </span>
      {visual ? (
        <CardMedia
          src={visual.src}
          alt={visual.alt}
          className={styles.visual}
          sizes="(max-width: 767px) calc(100vw - 88px), (max-width: 1279px) calc(50vw - 64px), 360px"
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
      {footer ? <span className={styles.footer}>{footer}</span> : null}
      {action ? (
        <span className={styles.action}>
          {action}
          <ArrowRight size={18} aria-hidden="true" />
        </span>
      ) : null}
    </>
  )

  if (href) {
    const external = href.startsWith('#') || href.startsWith('http')
    if (external) {
      return (
        <a className={className} href={href}>
          {body}
        </a>
      )
    }
    return (
      <Link className={className} href={href as Route}>
        {body}
      </Link>
    )
  }

  if (onOpen) {
    return (
      <button type="button" className={className} onClick={onOpen}>
        {body}
      </button>
    )
  }

  return (
    <article className={className} aria-label={name}>
      {body}
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
  const footer =
    card.openFlagCount > 0
      ? `${card.openFlagCount} Flag${card.openFlagCount === 1 ? '' : 's'}`
      : card.checkedAt
        ? 'Checked'
        : 'Not checked yet'
  const problem = card.problem

  return (
    <BoardCard
      name={card.name}
      status={card.status}
      state={card.state}
      answer={card.answer}
      detail={problem ? problem.body : card.detail}
      footer={problem ? undefined : footer}
      visual={card.captureUrl && card.captureAlt ? { src: card.captureUrl, alt: card.captureAlt } : null}
      crop={card.cropUrl && card.cropAlt ? { src: card.cropUrl, alt: card.cropAlt } : null}
      outcome={problem?.outcomeName}
      action={problem?.actionLabel}
      href={problem?.href}
      wide={card.wide}
      activity={card.activity}
      icon={Icon}
      onOpen={problem ? undefined : onOpen}
    />
  )
}
