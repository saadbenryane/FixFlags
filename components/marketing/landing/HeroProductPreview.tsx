import { Sparkles, Check } from 'lucide-react'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { Button } from '@/components/ui/button'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const { heroPreview } = LANDING_PAGE

const pipeline = [
  { label: 'Scanning', detail: 'Homepage', state: 'done' },
  { label: 'Analyzing', detail: '24 checks', state: 'done' },
  { label: 'Flags found', detail: '7', state: 'active' },
  { label: 'Generating fixes', detail: 'Agent-ready', state: 'pending' },
  { label: 'Report ready', detail: '2 min ago', state: 'pending' },
]

function CircleDot({ state }: { state: string }) {
  if (state === 'done') return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
      <Check className="h-3 w-3" />
    </span>
  )
  if (state === 'active') return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/15">
      <span className="h-2 w-2 rounded-full bg-orange-500" />
    </span>
  )
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
      <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
    </span>
  )
}

const partnerLogos = [
  { name: 'Vercel', color: '#000' },
  { name: 'Supabase', color: '#3ECF8E' },
  { name: 'Linear', color: '#5E6AD2' },
  { name: 'Lottie', color: '#00D8FF' },
]

export function HeroProductPreview({ className }: { className?: string }) {
  return (
    <div className={cn('relative mx-auto w-full max-w-5xl', className)}>
      {/* Soft glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,hsl(24_100%_60%/0.12),transparent_70%)]"
      />

      <div className="rounded-2xl border border-border/40 bg-card/95 shadow-2xl backdrop-blur-sm">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-red-400/80" />
            <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
            <span className="h-3 w-3 rounded-full bg-green-400/80" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            <span className="font-mono text-[11px] text-muted-foreground">fixflags.com</span>
          </div>
        </div>

        {/* Three panels */}
        <div className="grid gap-0 lg:grid-cols-[1fr_0.8fr_1.1fr]">

          {/* LEFT: mock product page */}
          <div className="hidden border-r border-border/30 p-5 lg:block">
            {/* mini browser bar */}
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" aria-hidden />
              <span className="font-mono text-[10px] text-muted-foreground">yourproduct.com</span>
            </div>

            {/* mock hero */}
            <div className="space-y-3 py-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">HERO SECTION</p>
              <h3 className="text-lg font-bold leading-tight">
                Build something{' '}
                <span className="bg-gradient-to-r from-orange-500 to-purple-500 bg-clip-text text-transparent">
                  amazing
                </span>{' '}
                with AI
              </h3>
              <p className="text-xs text-muted-foreground">
                The all-in-one platform for next-gen teams.
              </p>
              <div className="flex gap-2 pt-1">
                <button className="pointer-events-none rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white">
                  Get started
                </button>
                <button className="pointer-events-none rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  Book a demo
                </button>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <div className="flex -space-x-1">
                  {['bg-orange-400', 'bg-blue-400', 'bg-green-400'].map((c, i) => (
                    <span key={i} className={cn('h-5 w-5 rounded-full border-2 border-card', c)} />
                  ))}
                </div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-[10px] text-yellow-400">★</span>
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">12,000+ builders</span>
              </div>
            </div>

            {/* mock logos */}
            <div className="mt-4 border-t border-border/30 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                {partnerLogos.map((l) => (
                  <span
                    key={l.name}
                    className="font-sans text-[10px] font-bold"
                    style={{ color: l.color === '#000' ? 'currentColor' : l.color }}
                  >
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* MIDDLE: pipeline */}
          <div className="hidden border-r border-border/30 bg-muted/20 p-5 lg:block">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">SCAN PROGRESS</p>
            <ol className="space-y-4">
              {pipeline.map((step) => (
                <li key={step.label} className="flex items-center gap-3">
                  <CircleDot state={step.state} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        'text-sm',
                        step.state === 'done' && 'text-muted-foreground line-through',
                        step.state === 'active' && 'font-semibold text-foreground',
                        step.state === 'pending' && 'text-muted-foreground/50',
                      )}>
                        {step.label}
                      </span>
                      {step.state === 'active' ? (
                        <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          {step.detail}
                        </span>
                      ) : (
                        <span className={cn(
                          'text-[11px]',
                          step.state === 'done' ? 'text-muted-foreground' : 'text-muted-foreground/40'
                        )}>
                          {step.detail}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {/* mini score preview */}
            <div className="mt-6 rounded-xl border border-border/40 bg-card p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2">OVERALL SCORE</p>
              <div className="flex items-end gap-2">
                <span className="font-mono text-3xl font-bold tabular-nums">72</span>
                <span className="mb-1 text-xs text-muted-foreground">/ 100</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted/50">
                <div className="h-full w-[72%] rounded-full bg-orange-500" />
              </div>
            </div>
          </div>

          {/* RIGHT: flag card */}
          <div className="p-5">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">FLAG DETAIL</p>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-orange-500">
                  High impact
                </span>
                <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  MESSAGE
                </span>
              </div>

              <p className="text-base font-semibold leading-snug">{heroPreview.flag.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{heroPreview.flag.description}</p>

              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">EVIDENCE</p>
                <p className="rounded-lg bg-muted/50 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  {heroPreview.flag.evidence}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                  Impact: High
                </span>
                {heroPreview.flag.affects.map((tag) => (
                  <span key={tag} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-1.5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  FIX (AGENT-READY)
                </p>
                <p className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 text-sm leading-relaxed text-foreground/80">
                  {heroPreview.flag.fix}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Button size="sm" className="gap-2 bg-orange-500 hover:bg-orange-600 text-white" asChild>
                  <Link href="/docs/mcp">
                    <Sparkles className="h-3.5 w-3.5" />
                    Send to Cursor
                  </Link>
                </Button>
                <PromptCopyButton prompt={heroPreview.flag.fix} compact />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
