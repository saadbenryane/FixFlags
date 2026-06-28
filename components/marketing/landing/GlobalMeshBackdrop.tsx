import { cn } from '@/lib/utils'

interface GlobalMeshBackdropProps {
  className?: string
  fixed?: boolean
}

/**
 * Quiet, premium canvas. A single restrained brand glow at the top,
 * a faint hairline grid, and a soft vignette. No busy drifting orbs.
 */
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
      {/* Faint hairline grid for depth */}
      <div
        className={cn(
          'absolute inset-0 opacity-[0.5] dark:opacity-[0.4]',
          '[background-image:linear-gradient(to_right,hsl(var(--border-subtle)/0.6)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border-subtle)/0.6)_1px,transparent_1px)]',
          '[background-size:64px_64px]',
          '[mask-image:radial-gradient(120%_80%_at_50%_0%,black,transparent_70%)]'
        )}
      />

      {/* Single brand glow, centered above the fold */}
      <div
        className={cn(
          'absolute left-1/2 top-[-12rem] h-[34rem] w-[60rem] -translate-x-1/2 rounded-full blur-[120px]',
          'bg-gradient-orb-brand opacity-90 dark:opacity-100',
          'motion-safe:animate-peach-breathe motion-safe:will-change-[opacity,transform]'
        )}
      />

      {/* Soft secondary glow, low and offset, barely there */}
      <div
        className={cn(
          'absolute bottom-[-8rem] right-[-6rem] h-[26rem] w-[26rem] rounded-full blur-[110px]',
          'bg-gradient-orb-warm opacity-70 dark:opacity-60'
        )}
      />
    </div>
  )
}
