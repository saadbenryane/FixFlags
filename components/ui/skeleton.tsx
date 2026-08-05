import { cn } from "@/lib/utils"

/**
 * Keyframes for the opt-in shimmer sweep, injected via a <style> tag so the
 * animation stays colocated with this component instead of touching global
 * Tailwind config. Call sites gate the animation classes with motion-safe: so
 * reduced-motion users get a static block.
 */
export const SHIMMER_KEYFRAMES = `@keyframes ff-shimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}`

function Skeleton({
  className,
  shimmer = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { shimmer?: boolean }) {
  return (
    <>
      {shimmer ? <style>{SHIMMER_KEYFRAMES}</style> : null}
      <div
        className={cn(
          "rounded-md bg-muted",
          shimmer
            ? "relative overflow-hidden motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:animate-[ff-shimmer_1.8s_linear_infinite] motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent motion-safe:after:via-foreground/10 motion-safe:after:to-transparent"
            : "animate-pulse",
          className,
        )}
        {...props}
      />
    </>
  )
}

export { Skeleton }
