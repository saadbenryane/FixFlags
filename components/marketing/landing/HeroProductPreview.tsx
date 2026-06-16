import { Copy, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const { heroPreview } = LANDING_PAGE

export function HeroProductPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-5xl rounded-card bg-card p-3 shadow-card sm:p-4 lg:p-5',
        className
      )}
    >
      <div className="grid gap-3 lg:grid-cols-[1.05fr_0.75fr_1.1fr] lg:gap-4">
        <Card className="overflow-hidden border-0 bg-background shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
            <div className="flex gap-1" aria-hidden>
              <span className="h-2 w-2 rounded-full bg-destructive/70" />
              <span className="h-2 w-2 rounded-full bg-warning/80" />
              <span className="h-2 w-2 rounded-full bg-success/80" />
            </div>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {heroPreview.siteUrl}
            </span>
          </div>
          <div className="space-y-4 px-4 py-8 sm:px-6 sm:py-10">
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
              Hero
            </p>
            <p className="max-w-[16rem] text-lg font-medium leading-snug text-balance sm:text-xl">
              {heroPreview.siteHeadline}
            </p>
            <div className="h-9 w-28 rounded-md bg-muted/60" />
          </div>
        </Card>

        <Card className="border-0 bg-muted/20 p-4 shadow-sm">
          <ol className="space-y-3">
            {heroPreview.pipeline.map((step, index) => {
              const active = index === 2
              const done = index < 2
              return (
                <li key={step} className="flex items-start gap-3 text-sm">
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px]',
                      done && 'bg-success/15 text-success',
                      active && 'bg-brand/15 text-brand',
                      !done && !active && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {done ? '✓' : index + 1}
                  </span>
                  <span className={cn(active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                    {step}
                  </span>
                </li>
              )
            })}
          </ol>
        </Card>

        <Card className="border-0 bg-background p-4 shadow-sm sm:p-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-brand/10 text-brand hover:bg-brand/10">{heroPreview.flag.severity}</Badge>
              <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                {heroPreview.flag.rubric}
              </span>
            </div>
            <p className="text-base font-semibold">{heroPreview.flag.title}</p>

            <div className="space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">Evidence</p>
              <p className="rounded-nested-md bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
                {heroPreview.flag.evidence}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Impact: {heroPreview.flag.impact}</Badge>
              {heroPreview.flag.affects.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                Fix (Agent-ready)
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{heroPreview.flag.fix}</p>
            </div>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <Button size="sm" className="gap-2">
                Send to Cursor
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" className="gap-2">
                Copy prompt
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-8 -top-12 -z-10 h-40 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,hsl(var(--brand)/0.12),transparent_70%)]"
      />
    </div>
  )
}
