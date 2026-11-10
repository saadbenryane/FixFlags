'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Check, CircleAlert, CircleHelp, Clock3, Loader2 } from 'lucide-react'
import type { Route } from 'next'
import { outcomeStatusLabel, staleOutcomeRecovery, type CustomerOutcomeState } from '@/lib/sites/outcome-state'
import { useOutcomeState } from '@/hooks/useOutcomeState'
import { cn } from '@/lib/utils'
import styles from './BoardCard.module.css'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

export function OutcomeSummaryCard({
  name,
  href,
  expectation,
  answer,
  coverage,
  freshness,
  nextStep,
  state: recordedState,
  validUntil,
  running = false,
  label = 'Website check',
  actions,
  compact = false,
  layout = 'card',
}: {
  name: string
  href?: Route
  expectation: string
  answer?: string
  coverage: string
  freshness: string
  nextStep?: string
  state: CustomerOutcomeState
  validUntil?: string | null
  running?: boolean
  label?: string
  actions?: ReactNode
  compact?: boolean
  layout?: 'card' | 'row'
}) {
  const state = useOutcomeState(recordedState, validUntil, running)
  const recovery = nextStep ?? (state === 'STALE' ? staleOutcomeRecovery() : undefined)
  const result = answer && answer !== expectation ? answer : null
  const StateIcon = state === 'CLEAR' ? Check : state === 'FLAG' ? CircleAlert : state === 'STALE' ? Clock3 : CircleHelp
  const evidenceTime = running && result ? `${SITE_ACTION_COPY.previousResults}, ${freshness}` : freshness
  const status = <span className={cn(
    'inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-sm font-medium',
    !running && state === 'CLEAR' && 'border-success/30 text-success',
    !running && state === 'FLAG' && 'border-brand text-brand',
    (running || state === 'STALE' || state === 'COULD_NOT_VERIFY') && 'border-border text-muted-foreground'
  )} role="status">
    {running ? <Loader2 className="h-4 w-4 shrink-0 text-brand motion-safe:animate-spin" aria-hidden />
      : layout !== 'row' ? <StateIcon className="h-4 w-4" aria-hidden /> : null}
    {running ? SITE_ACTION_COPY.outcome.verifying : outcomeStatusLabel(state)}
  </span>
  if (layout === 'row') {
    return <section className={cn(styles.boardRow, styles.outcomeRow)}>
      <div className={cn(styles.rowTitle, styles.outcomeRowTitle)}>
        <StateIcon className="h-[18px] w-[18px]" aria-hidden />
        <div>{label !== 'Website check' ? <small>{label}</small> : null}<h2>{href ? <Link href={href} className="hover:underline">{name}</Link> : name}</h2></div>
      </div>
      {result || !running || recovery ? <div className={styles.rowResult}>
        {result ? <strong>{result}</strong> : !running ? <span>{SITE_ACTION_COPY.expected}: <span>{expectation}</span></span> : null}
        {recovery ? <span className={styles.rowNextStep}>{recovery}</span> : null}
        {!running || result ? <span>{evidenceTime}</span> : null}
      </div> : null}
      <span className={styles.rowStatus}>{status}</span>
      {actions ? <div className={styles.outcomeRowActions}>{actions}</div> : null}
    </section>
  }
  return (
    <section className={compact ? styles.card : 'rounded-board-panel bg-background p-5 shadow-board sm:p-6'}>
      <div className={cn('flex flex-wrap items-start justify-between gap-4', compact && 'h-full w-full flex-col')}>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <h2 className={cn('mt-1 font-semibold', compact ? 'text-lg' : 'text-xl')}>
            {href ? <Link href={href} className="hover:underline">{name}</Link> : name}
          </h2>
          <p className={cn('mt-2 max-w-2xl text-sm', result ? 'text-foreground' : 'text-muted-foreground')}>{result ?? expectation}</p>
          {result && !compact ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{expectation}</p> : null}
          {recovery ? <p className="mt-2 max-w-2xl text-sm font-medium">{recovery}</p> : null}
          {!compact ? <p className="mt-2 text-xs text-muted-foreground">{coverage}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">{evidenceTime}</p>
        </div>
        <div className={cn('flex gap-3', compact ? 'mt-auto w-full flex-wrap items-center justify-between' : 'min-w-[9rem] flex-col items-end')}>
          {status}
          {actions}
        </div>
      </div>
    </section>
  )
}
