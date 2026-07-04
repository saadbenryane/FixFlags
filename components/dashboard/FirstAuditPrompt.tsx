import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'

const EXAMPLE_URLS = [
  { label: 'Your Product Hunt page', hint: 'producthunt.com/posts/your-product' },
  { label: 'Your demo day landing page', hint: 'yourstartup.com' },
  { label: 'A client site before handoff', hint: 'clientsite.com' },
]

export function FirstAuditPrompt() {
  return (
    <Card className="border-0 p-6 shadow-card sm:p-8 space-y-6">
      <div className="space-y-2">
        <p className="text-base font-semibold">Paste the URL you are about to share.</p>
        <p className="text-sm text-muted-foreground">
          FixFlags reviews your page before anyone else sees it. You get Flags across Message,
          Experience, and Reach. Each Flag includes a fix prompt ready to paste into
          Cursor, Claude, Lovable, or Bolt.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Common first checks</p>
        <ul className="space-y-2">
          {EXAMPLE_URLS.map((item) => (
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
          Not sure what to check first?{' '}
          <Link href="/samples" className="text-foreground underline underline-offset-2 hover:text-foreground/80">
            See a sample report
          </Link>{' '}
          to know what you will get.
        </p>
      </div>
    </Card>
  )
}
