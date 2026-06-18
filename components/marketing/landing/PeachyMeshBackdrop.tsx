import { cn } from '@/lib/utils'

interface GlobalMeshBackdropProps {
  className?: string
  fixed?: boolean
}

export function GlobalMeshBackdrop({ className, fixed = false }: GlobalMeshBackdropProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none overflow-hidden',
        fixed ? 'fixed inset-0 -z-10' : 'absolute inset-0',
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-peach-surface" />

      <div
        className={cn(
          'absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gradient-orb-peach blur-3xl',
          'motion-safe:animate-peach-drift-a motion-safe:will-change-transform'
        )}
      />
      <div
        className={cn(
          'absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-gradient-orb-warm blur-3xl',
          'motion-safe:animate-peach-drift-b motion-safe:will-change-transform'
        )}
      />
      <div
        className={cn(
          'absolute left-1/3 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-gradient-orb-brand blur-3xl',
          'motion-safe:animate-peach-breathe motion-safe:will-change-transform'
        )}
      />
      <div
        className={cn(
          'absolute -bottom-8 right-1/4 h-56 w-56 rounded-full bg-gradient-orb-peach blur-3xl opacity-70',
          'motion-safe:animate-peach-drift-b motion-safe:[animation-delay:4s] motion-safe:will-change-transform'
        )}
      />
    </div>
  )
}

/** @deprecated Use GlobalMeshBackdrop */
export const PeachyMeshBackdrop = GlobalMeshBackdrop
