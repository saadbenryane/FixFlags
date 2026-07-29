import { cn } from '@/lib/utils'

interface GlobalMeshBackdropProps {
  className?: string
  fixed?: boolean
  /** `minimal` is a quiet static grid for dense app/admin screens. */
  intensity?: 'full' | 'minimal' | 'off'
}

const GRID_LAYER =
  '[background-image:linear-gradient(to_right,hsl(var(--border-subtle)/0.6)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border-subtle)/0.6)_1px,transparent_1px)] [background-size:64px_64px]'

/**
 * Quiet, premium canvas. A restrained brand wash at the top,
 * and soft stone-toned depth.
 *
 * Marketing (`full`) must not use grid/dot backgrounds behind the hero
 * (see DESIGN.md). `GRID_LAYER` is app/admin-only via `minimal`.
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
          fixed ? 'fixed inset-0 -z-background' : 'absolute inset-0',
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

  // Marketing uses the page canvas and section tints directly. Keeping the
  // full backdrop empty prevents decorative light from competing with proof.
  return null
}
