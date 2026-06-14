import { TRUST_STRIP } from '@/lib/marketing/copy'

export function TrustStrip() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
      {TRUST_STRIP.map((item, i) => (
        <span key={item} className="flex items-center gap-6">
          <span className="font-mono text-[11px] uppercase tracking-label text-muted-foreground/80">{item}</span>
          {i < TRUST_STRIP.length - 1 ? (
            <span aria-hidden className="hidden h-1 w-1 rounded-full bg-muted-foreground/30 sm:block" />
          ) : null}
        </span>
      ))}
    </div>
  )
}
