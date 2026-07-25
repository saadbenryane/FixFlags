import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Center visual for the check-dimensions section.
 *
 * Prefer a true RGBA plate (`check-dimensions-center.webp`) with clean soft
 * edges — never soft-key a JPEG-on-white mockup into alpha (white fringe).
 * Until a hi-res transparent master lands, render the CSS scene so the mesh
 * backdrop shows through without a white plate.
 */
export const CHECK_DIMENSIONS_CENTER = {
  src: '/marketing/visuals/check-dimensions-center.webp',
  width: 790,
  height: 540,
  /** Flip to true when the shipped WebP is a true RGBA master (no white plate). */
  useImageAsset: false,
} as const

type CheckDimensionsSceneProps = {
  className?: string
  /** Which rubric nav icon is lit in the scene sidebar. */
  active?: 'message' | 'experience' | 'reach'
}

export function CheckDimensionsScene({
  className,
  active = 'message',
}: CheckDimensionsSceneProps) {
  if (CHECK_DIMENSIONS_CENTER.useImageAsset) {
    return (
      <div className={cn('relative mx-auto w-full max-w-md lg:max-w-none', className)}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[12%] rounded-[40%] bg-brand/20 blur-3xl"
        />
        <Image
          src={CHECK_DIMENSIONS_CENTER.src}
          alt=""
          width={CHECK_DIMENSIONS_CENTER.width}
          height={CHECK_DIMENSIONS_CENTER.height}
          sizes="(min-width: 1024px) 380px, 90vw"
          loading="lazy"
          unoptimized
          className="relative w-full object-contain drop-shadow-[0_28px_48px_-24px_hsl(240_8%_5%/0.22)]"
        />
      </div>
    )
  }

  return (
    <div
      className={cn('relative mx-auto w-full max-w-[22rem] sm:max-w-md lg:max-w-none', className)}
      aria-hidden
    >
      {/* Soft orange ambient — no baked white plate */}
      <div className="pointer-events-none absolute inset-[18%_10%_8%] rounded-[45%] bg-brand/25 blur-3xl" />

      {/* Plinth */}
      <div className="relative rounded-[1.75rem] bg-background px-3 pb-5 pt-4 shadow-[0_24px_48px_-28px_hsl(240_8%_5%/0.28),0_2px_6px_hsl(240_8%_5%/0.06)] sm:px-4 sm:pb-6 sm:pt-5">
        <div className="flex gap-2.5 sm:gap-3">
          {/* Sidebar */}
          <div className="flex w-9 shrink-0 flex-col items-center gap-2.5 rounded-2xl bg-muted/45 py-3 sm:w-10 sm:gap-3 sm:py-3.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-[0.65rem] font-bold text-brand-foreground">
              F
            </span>
            <SidebarDot />
            <SidebarDot lit={active === 'message'} />
            <SidebarDot lit={active === 'experience'} />
            <SidebarDot lit={active === 'reach'} />
            <SidebarDot />
            <SidebarDot />
            <SidebarDot />
          </div>

          {/* Overlapping cards */}
          <div className="relative min-h-[14.5rem] flex-1 sm:min-h-[16.5rem]">
            {/* Back / fail card */}
            <div className="absolute left-0 top-3 w-[72%] rounded-2xl bg-background p-3 shadow-card sm:top-4 sm:p-3.5">
              <div className="mb-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <span className="text-xs font-bold leading-none">×</span>
              </div>
              <div className="space-y-1.5">
                <div className="h-1.5 w-[88%] rounded-full bg-muted" />
                <div className="h-1.5 w-[72%] rounded-full bg-muted" />
                <div className="h-1.5 w-[64%] rounded-full bg-muted" />
              </div>
              <div className="mt-3 h-5 w-14 rounded-full bg-foreground/90" />
            </div>

            {/* Front / pass card */}
            <div className="absolute bottom-0 right-0 w-[78%] overflow-hidden rounded-2xl bg-background shadow-[0_12px_32px_-12px_hsl(240_8%_5%/0.28)] sm:w-[80%]">
              <div className="relative p-3.5 sm:p-4">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-tr from-transparent via-transparent to-brand/20" />
                <div className="relative mb-2.5 flex items-start justify-between">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success">
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                      <path
                        d="M3.5 8.2 6.4 11l6-6.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="flex gap-1 pt-1">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/35" />
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/35" />
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/35" />
                  </div>
                </div>
                <div className="relative space-y-1.5">
                  <div className="h-1.5 w-[90%] rounded-full bg-foreground/85" />
                  <div className="h-1.5 w-[78%] rounded-full bg-foreground/55" />
                  <div className="h-1.5 w-[62%] rounded-full bg-foreground/40" />
                </div>
                <div className="relative mt-3 h-5 w-16 rounded-full bg-foreground" />
              </div>
              <div className="relative flex items-center justify-center gap-3 border-t border-border/40 px-3 py-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-2 w-2 rounded-full',
                      i === 1 ? 'bg-brand' : 'bg-transparent ring-1 ring-border'
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarDot({ lit = false }: { lit?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-lg transition-colors',
        lit
          ? 'bg-brand/15 text-brand shadow-[0_0_0_3px_hsl(var(--brand)_/_0.12)]'
          : 'text-muted-foreground/45'
      )}
    >
      <span
        className={cn('h-2 w-2 rounded-[3px]', lit ? 'bg-brand' : 'bg-current opacity-80')}
      />
    </span>
  )
}
