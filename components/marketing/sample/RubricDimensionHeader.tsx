'use client'

import { Globe2, MessageSquare, Zap } from 'lucide-react'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const RUBRIC_META = {
  MESSAGE: {
    icon: MessageSquare,
    tint: 'text-brand',
    border: 'border-brand/40',
    wash: 'bg-brand/[0.06]',
  },
  EXPERIENCE: {
    icon: Zap,
    tint: 'text-success',
    border: 'border-success/40',
    wash: 'bg-success/[0.06]',
  },
  REACH: {
    icon: Globe2,
    tint: 'text-info',
    border: 'border-info/40',
    wash: 'bg-info/[0.06]',
  },
} as const

type RubricKey = keyof typeof RUBRIC_META

function dimensionCopy(rubric: string) {
  const id = rubric.toLowerCase() as 'message' | 'experience' | 'reach'
  return LANDING_PAGE.checkDimensions.cards.find((c) => c.id === id)
}

interface RubricDimensionHeaderProps {
  rubric: string
  className?: string
  compact?: boolean
}

export function RubricDimensionHeader({
  rubric,
  className,
  compact = false,
}: RubricDimensionHeaderProps) {
  const meta = RUBRIC_META[rubric as RubricKey] ?? RUBRIC_META.MESSAGE
  const copy = dimensionCopy(rubric)
  const Icon = meta.icon

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-card border-l-[3px] px-3 py-2.5',
        meta.border,
        meta.wash,
        className
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.tint)} aria-hidden />
      <div className="min-w-0">
        <p className={cn('font-semibold leading-none', meta.tint, compact ? 'text-sm' : 'text-base')}>
          {copy?.title ?? rubric}
        </p>
        {!compact && copy?.question && (
          <p className="mt-1 text-sm leading-snug text-muted-foreground text-pretty">{copy.question}</p>
        )}
      </div>
    </div>
  )
}

export function rubricTintClass(rubric: string): string {
  const meta = RUBRIC_META[rubric as RubricKey]
  return meta?.tint ?? 'text-brand'
}

export function RubricPill({ rubric, label }: { rubric: string; label: string }) {
  const meta = RUBRIC_META[rubric as RubricKey] ?? RUBRIC_META.MESSAGE
  const Icon = meta.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold',
        meta.wash,
        meta.tint
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </span>
  )
}
