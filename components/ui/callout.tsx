import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  Info,
  TriangleAlert,
  CircleCheck,
  CircleX,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Callout - the single, consistent way to surface system status in FixFlags
 * (NN/g #1 visibility of system status, #4 consistency, #9 error recovery).
 *
 * Deference by default: a calm tinted surface with one colored icon, depth via
 * radius not borders. Partial/limited states are first-class, never a red scare.
 */
const calloutVariants = cva(
  'flex gap-3 rounded-card px-4 py-3 text-sm leading-body text-pretty',
  {
    variants: {
      variant: {
        neutral: 'bg-muted/50 text-muted-foreground',
        info: 'bg-info/10 text-foreground',
        success: 'bg-success-muted text-foreground',
        warning: 'bg-warning/15 text-foreground',
        danger: 'bg-destructive/10 text-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
)

const iconByVariant: Record<NonNullable<CalloutVariant>, LucideIcon> = {
  neutral: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
}

const iconColorByVariant: Record<NonNullable<CalloutVariant>, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
}

type CalloutVariant = VariantProps<typeof calloutVariants>['variant']

export interface CalloutProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof calloutVariants> {
  title?: React.ReactNode
  /** Override the default variant icon. Pass null to hide it. */
  icon?: LucideIcon | null
}

export function Callout({
  className,
  variant = 'neutral',
  title,
  icon,
  children,
  ...props
}: CalloutProps) {
  const v = (variant ?? 'neutral') as NonNullable<CalloutVariant>
  const Icon = icon === null ? null : icon ?? iconByVariant[v]

  return (
    <div
      role={v === 'danger' ? 'alert' : 'status'}
      className={cn(calloutVariants({ variant }), className)}
      {...props}
    >
      {Icon && (
        <Icon
          className={cn('mt-0.5 h-4 w-4 shrink-0', iconColorByVariant[v])}
          aria-hidden
        />
      )}
      <div className="min-w-0 space-y-1">
        {title && <p className="font-medium text-foreground">{title}</p>}
        {children && <div className="text-pretty">{children}</div>}
      </div>
    </div>
  )
}
