import { Check, X } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'

function CircleScore({
  score,
  positive,
}: {
  score: number
  positive: boolean
}) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-white/10" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            className={positive ? 'text-emerald-400' : 'text-orange-400'}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-2xl font-bold tabular-nums text-white">{score}</span>
        </div>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Performance</span>
    </div>
  )
}

const BEFORE_ITEMS = [
  'Vague hero, low clarity',
  'Slow mobile load',
  'Missing social preview',
  'Weak CTA',
]

const AFTER_ITEMS = [
  'Clear value in 5 seconds',
  'Faster and smoother',
  'Great social preview',
  'Stronger CTA',
]

export function RealImpactSection() {
  return (
    <Section spacing="marketing" id="real-impact" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-12 sm:space-y-16">
        <LandingSectionHeader
          label="SEE WHAT CHANGED"
          headline="Real impact. Not opinions."
        />

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          {/* BEFORE */}
          <div className="rounded-2xl bg-gray-900 p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-white/40">BEFORE</span>
            </div>

            {/* mock headline */}
            <div className="mb-5 rounded-xl border border-white/5 bg-white/5 px-4 py-3">
              <p className="text-sm font-semibold text-white/60 line-through">
                Build something amazing with AI
              </p>
              <p className="mt-1 text-[11px] text-white/30">The all-in-one platform for next-gen teams.</p>
            </div>

            <ul className="space-y-2.5">
              {BEFORE_ITEMS.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                    <X className="h-3 w-3 text-red-400" aria-hidden />
                  </span>
                  <span className="text-white/60">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
              <span className="text-xs text-white/30">Overall score</span>
              <CircleScore score={62} positive={false} />
            </div>
          </div>

          {/* AFTER */}
          <div className="rounded-2xl bg-gray-900 p-6 ring-1 ring-emerald-500/20 sm:p-8">
            <div className="mb-5 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-white/40">AFTER</span>
            </div>

            {/* mock headline */}
            <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <p className="text-sm font-semibold text-white">
                Ship AI products users love.
              </p>
              <div className="mt-2 inline-block rounded-md bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white">
                Start free
              </div>
            </div>

            <ul className="space-y-2.5">
              {AFTER_ITEMS.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-3 w-3 text-emerald-400" aria-hidden />
                  </span>
                  <span className="text-white/80">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
              <span className="text-xs text-white/30">Overall score</span>
              <CircleScore score={92} positive={true} />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
