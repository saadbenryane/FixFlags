import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { FIRST_AUDIT_PROMPT } from '@/lib/marketing/copy'

export function FirstAuditPrompt() {
  return (
    <Card className="border-0 p-6 shadow-card sm:p-8 space-y-6">
      <div className="space-y-2">
        <p className="text-base font-semibold">{FIRST_AUDIT_PROMPT.headline}</p>
        <p className="text-sm text-muted-foreground">{FIRST_AUDIT_PROMPT.body}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {FIRST_AUDIT_PROMPT.examplesLabel}
        </p>
        <ul className="space-y-2">
          {FIRST_AUDIT_PROMPT.examples.map((item) => (
            <li key={item.hint} className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              <span>
                <span className="text-foreground font-medium">{item.label}</span>
                <span className="ml-1.5 text-muted-foreground/70">{item.hint}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          {FIRST_AUDIT_PROMPT.footerPrefix}{' '}
          <Link
            href="/samples"
            className="text-foreground underline underline-offset-2 hover:text-foreground/80"
          >
            {FIRST_AUDIT_PROMPT.footerLink}
          </Link>{' '}
          {FIRST_AUDIT_PROMPT.footerSuffix}
        </p>
      </div>
    </Card>
  )
}
