import type { ReactNode } from 'react'
import Link from 'next/link'
import { Check, CircleAlert, CircleHelp, Clock3 } from 'lucide-react'
import type { Route } from 'next'
import { outcomeStatusLabel } from '@/lib/sites/outcome-state'
import { cn } from '@/lib/utils'

type OutcomeState = 'CLEAR' | 'FLAG' | 'COULD_NOT_VERIFY' | 'STALE'

export function OutcomeSummaryCard({
  name,
  href,
  expectation,
  answer,
  coverage,
  freshness,
  nextStep,
  state,
  running = false,
  label = 'Watched Outcome',
  actions,
}: {
  name: string
  href?: Route
  expectation: string
  answer?: string
  coverage: string
  freshness: string
  nextStep?: string
  state: OutcomeState
  running?: boolean
  label?: string
  actions?: ReactNode
}) {
  const result = answer && answer !== expectation ? answer : null
  const StateIcon = state === 'CLEAR' ? Check : state === 'FLAG' ? CircleAlert : state === 'STALE' ? Clock3 : CircleHelp
  return (
    <section className="rounded-2xl border border-border/80 bg-background p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <h2 className="mt-1 text-xl font-semibold">
            {href ? <Link href={href} className="hover:underline">{name}</Link> : name}
          </h2>
          <p className={cn('mt-2 max-w-2xl text-sm', result ? 'text-foreground' : 'text-muted-foreground')}>{result ?? expectation}</p>
          {result ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{expectation}</p> : null}
          {nextStep ? <p className="mt-2 max-w-2xl text-sm font-medium">{nextStep}</p> : null}
          <p className="mt-2 text-xs text-muted-foreground">{coverage}</p>
          <p className="mt-1 text-xs text-muted-foreground">{freshness}</p>
        </div>
        <div className="flex min-w-[9rem] flex-col items-end gap-3">
          <span className={cn(
            'inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-sm font-medium',
            state === 'CLEAR' && 'border-success/30 text-success',
            state === 'FLAG' && 'border-brand text-brand',
            (state === 'STALE' || state === 'COULD_NOT_VERIFY') && 'border-border text-muted-foreground'
          )} role="status">
            <StateIcon className={cn('h-4 w-4', running && 'motion-safe:animate-pulse')} aria-hidden />
            {outcomeStatusLabel(state, running)}
          </span>
          {actions}
        </div>
      </div>
    </section>
  )
}
