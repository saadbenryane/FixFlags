import { cn } from '@/lib/utils'

interface GlobalMeshBackdropProps {
  className?: string
  fixed?: boolean
  /**
   * `full` shows the restrained marketing canvas (hairline grid + brand glow).
   * `minimal` is a quiet static grid for dense app/admin screens. `off`
   * renders nothing.
   */
  intensity?: 'full' | 'minimal' | 'off'
}

const GRID_LAYER =
  '[background-image:linear-gradient(to_right,hsl(var(--border-subtle)/0.6)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border-subtle)/0.6)_1px,transparent_1px)] [background-size:64px_64px]'

/**
 * Quiet, premium canvas. A restrained brand wash at the top,
 * a faint hairline grid, and soft stone-toned depth.
 */
export function GlobalMeshBackdrop({
  className,
  fixed = false,
  intensity = 'full',
}: GlobalMeshBackdropProps) {
  if (intensity === 'off') return null

  if (intensity === 'minimal') {
    return (
      <div
        aria-hidden
        className={cn(
          'pointer-events-none overflow-hidden',
          fixed ? 'fixed inset-0 -z-10' : 'absolute inset-0',
          className
        )}
      >
        <div
          className={cn(
            'absolute inset-0 opacity-[0.45] dark:opacity-[0.3]',
            GRID_LAYER,
            '[mask-image:radial-gradient(120%_80%_at_50%_0%,black,transparent_72%)]'
          )}
        />
      </div>
    )
  }

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
          GRID_LAYER,
          '[mask-image:radial-gradient(120%_80%_at_50%_0%,black,transparent_70%)]'
        )}
      />

      {/* Broad brand wash, centered above the fold */}
      <div
        className={cn(
          'absolute left-1/2 top-[-18rem] h-[38rem] w-[88rem] -translate-x-1/2 blur-[120px]',
          '[background:radial-gradient(ellipse_72%_48%_at_50%_48%,hsl(var(--brand)/0.14),hsl(28_80%_72%/0.08)_38%,transparent_72%)] opacity-95 dark:opacity-100',
          'motion-safe:animate-peach-breathe motion-safe:will-change-[opacity,transform]'
        )}
      />

      {/* Soft stone reflection, low and offset, barely there */}
      <div
        className={cn(
          'absolute bottom-[-11rem] right-[-16rem] h-[28rem] w-[48rem] -rotate-6 blur-[110px]',
          '[background:radial-gradient(ellipse_70%_46%_at_50%_50%,hsl(38_22%_74%/0.2),transparent_70%)] opacity-70 dark:opacity-45'
        )}
      />
    </div>
  )
}
