import { Check, Copy } from 'lucide-react'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { SeveritySignal } from '@/components/report/SeveritySignal'
import { Card } from '@/components/ui/card'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import { cn } from '@/lib/utils'

interface HeroProductPreviewProps {
  className?: string
  model: ReportExplorerModel
}

export function HeroProductPreview({ className, model }: HeroProductPreviewProps) {
  const items = model.flags.slice(0, 3)
  const selected = items[0]

  return (
    <div className={cn('relative mx-auto w-full max-w-5xl', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,hsl(var(--foreground)/0.04),transparent_68%)]"
      />
      <Card variant="strong" className="overflow-hidden">
        <div className="border-b border-border/40 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="section-label">Finish Plan</p>
              <h3 className="mt-1 font-serif text-xl font-medium tracking-display sm:text-2xl">
                Three fixes before you ship
              </h3>
            </div>
            <span className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
              Evidence included
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
          <ol className="divide-y divide-border/35 border-b border-border/40 lg:border-b-0 lg:border-r">
            {items.map((item, index) => (
              <li key={item.id} className={cn('p-4 sm:p-5', index === 0 && 'bg-brand/[0.045]')}>
                <div className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground font-mono text-xs font-bold text-background">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <SeveritySignal severity={item.severity} />
                      <span className="meta-label text-muted-foreground">{item.rubricLabel}</span>
                    </div>
                    <p className="text-sm font-medium leading-snug text-pretty">{item.title}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {selected ? (
            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Check className="h-4 w-4 text-success" aria-hidden />
                  Evidence from the page
                </div>
                <p className="text-sm leading-relaxed text-foreground/85 text-pretty">{selected.evidence}</p>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Copy className="h-4 w-4 text-brand" aria-hidden />
                  Ready for your AI editor
                </div>
                <FixPromptBlock
                  prompt={selected.copyFixPrompt}
                  toolPrompts={selected.toolPrompts}
                  showToolSelector
                  rows={4}
                  variant="compact"
                  nested
                />
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
