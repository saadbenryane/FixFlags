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
      <div
        className={cn(
          'absolute inset-0 bg-gradient-peach-surface bg-[length:200%_200%]',
          'motion-safe:animate-peach-surface-shift motion-safe:will-change-[background-position]'
        )}
      />

      <div
        className={cn(
          'absolute -right-20 -top-28 h-[28rem] w-[28rem] rounded-full bg-gradient-orb-peach blur-[88px]',
          'motion-safe:animate-peach-drift-a motion-safe:will-change-transform'
        )}
      />
      <div
        className={cn(
          'absolute -bottom-24 -left-20 h-[26rem] w-[26rem] rounded-full bg-gradient-orb-warm blur-[80px]',
          'motion-safe:animate-peach-drift-b motion-safe:will-change-transform'
        )}
      />
      <div
        className={cn(
          'absolute left-[18%] top-[38%] h-80 w-80 rounded-full bg-gradient-orb-brand blur-[72px]',
          'motion-safe:animate-peach-breathe motion-safe:will-change-[opacity,transform]'
        )}
      />
      <div
        className={cn(
          'absolute -bottom-12 right-[12%] h-72 w-72 rounded-full bg-gradient-orb-coral blur-[76px] opacity-80',
          'motion-safe:animate-peach-drift-b motion-safe:[animation-delay:3s] motion-safe:will-change-transform'
        )}
      />
      <div
        className={cn(
          'absolute right-[38%] top-[8%] h-56 w-56 rounded-full bg-gradient-orb-peach blur-[64px] opacity-60',
          'motion-safe:animate-peach-drift-a motion-safe:[animation-delay:6s] motion-safe:will-change-transform'
        )}
      />
      <div
        className={cn(
          'absolute bottom-[22%] left-[42%] h-64 w-64 rounded-full bg-gradient-orb-warm blur-[68px] opacity-50',
          'motion-safe:animate-peach-drift-a motion-safe:[animation-delay:9s] motion-safe:will-change-transform'
        )}
      />
    </div>
  )
}

/** @deprecated Use GlobalMeshBackdrop */
export const PeachyMeshBackdrop = GlobalMeshBackdrop
