import { AuditInput } from '@/components/audit/AuditInput'
import { ArrowRight, CheckCircle2, Zap } from 'lucide-react'
import Link from 'next/link'

const SAMPLE_FINDINGS = [
  { area: 'Mobile', grade: 'C', issue: 'Primary CTA below fold at 375px' },
  { area: 'SEO', grade: 'D', issue: 'og:image missing — link previews show blank' },
  { area: 'Performance', grade: 'B', issue: '320KB of unused JavaScript' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight">QualityOS</span>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/docs/mcp" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            MCP
          </Link>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          <Zap className="h-3 w-3 text-primary" />
          Built for the vibe coding community
        </div>

        <div className="space-y-4 max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your agent built it.{' '}
            <span className="text-primary">QualityOS checks if it works.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Run a quality audit on any website. Get evidence-backed issues across 7 areas.
            Copy fix prompts straight into your AI agent. Re-check after fixes.
          </p>
        </div>

        <AuditInput />

        <p className="text-xs text-muted-foreground">
          Free — no account needed. Takes under 60 seconds.
        </p>

        {/* Sample findings teaser */}
        <div className="w-full max-w-lg mt-4 rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="border-b px-4 py-3 bg-muted/30 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="text-xs text-muted-foreground ml-2">Sample audit results</span>
          </div>
          <div className="divide-y">
            {SAMPLE_FINDINGS.map((f) => (
              <div key={f.issue} className="flex items-center gap-3 px-4 py-3">
                <span className={`text-sm font-bold w-6 text-center rounded ${
                  f.grade === 'D' ? 'text-orange-600' : f.grade === 'C' ? 'text-yellow-600' : 'text-lime-600'
                }`}>
                  {f.grade}
                </span>
                <span className="text-xs text-muted-foreground w-16 shrink-0">{f.area}</span>
                <span className="text-sm">{f.issue}</span>
              </div>
            ))}
          </div>
          <div className="border-t px-4 py-3 bg-muted/20 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">
              Each finding includes a copy-ready fix prompt for Cursor, Claude, Lovable, or Bolt
            </span>
          </div>
        </div>
      </section>

      {/* Features strip */}
      <section className="border-t px-6 py-12">
        <div className="max-w-4xl mx-auto grid grid-cols-1 gap-6 sm:grid-cols-3 text-center">
          {[
            { title: '7 Quality Areas', desc: 'Performance, Accessibility, SEO, Conversion, Trust, Content, Mobile' },
            { title: 'Agent-Ready Prompts', desc: 'One prompt per area fixes everything at once. Paste directly into your AI agent.' },
            { title: 'MCP Integration', desc: 'Connect QualityOS directly to Claude Code, Cursor, or Windsurf via MCP.' },
          ].map((f) => (
            <div key={f.title} className="space-y-2">
              <div className="font-semibold">{f.title}</div>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
        <span>© 2026 QualityOS</span>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/docs/mcp" className="hover:text-foreground transition-colors">MCP Docs</Link>
        </div>
      </footer>
    </main>
  )
}
