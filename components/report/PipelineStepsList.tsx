'use client'

import { Check } from 'lucide-react'
import type { PipelineStep } from '@/lib/audit/report-pipeline-steps'
import { cn } from '@/lib/utils'

function StepDot({ state }: { state: PipelineStep['state'] }) {
  if (state === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="h-3 w-3" aria-hidden />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15">
        <span className="h-2 w-2 rounded-full bg-brand motion-safe:animate-pulse" />
      </span>
    )
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
      <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
    </span>
  )
}

function PipelineStepIndicator({ step }: { step: PipelineStep }) {
  if (step.id === 'flags' && step.state === 'active') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-bold leading-none text-brand-foreground">
        {step.detail}
      </span>
    )
  }
  return <StepDot state={step.state} />
}

export function PipelineStepsList({ steps }: { steps: PipelineStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.id} className="flex items-center gap-3">
          <PipelineStepIndicator step={step} />
          <span
            className={cn(
              'text-sm',
              step.state === 'done' && 'text-muted-foreground line-through',
              step.state === 'active' && 'font-semibold text-foreground',
              step.state === 'pending' && 'text-muted-foreground/50'
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  )
}
