import { MessageSquare, Zap, Shield, Globe2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { cn } from '@/lib/utils'

const DIMENSIONS = [
  {
    id: 'message',
    title: 'Message',
    question: 'Can people understand and care?',
    body: 'Clarity, positioning, copy, and the story you tell.',
    Icon: MessageSquare,
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-500',
    border: 'border-orange-500/20',
    glow: 'hover:shadow-orange-500/10',
  },
  {
    id: 'experience',
    title: 'Experience',
    question: 'Can people use it without friction?',
    body: 'UX, speed, mobile, flows, and technical polish.',
    Icon: Zap,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    border: 'border-emerald-500/20',
    glow: 'hover:shadow-emerald-500/10',
  },
  {
    id: 'trust',
    title: 'Trust',
    question: 'Can people believe it\'s safe and real?',
    body: 'Credibility, proof, security, and brand signals.',
    Icon: Shield,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    border: 'border-blue-500/20',
    glow: 'hover:shadow-blue-500/10',
  },
  {
    id: 'reach',
    title: 'Reach',
    question: 'Can people find and share it?',
    body: 'SEO, metadata, social preview, and discoverability.',
    Icon: Globe2,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-500',
    border: 'border-purple-500/20',
    glow: 'hover:shadow-purple-500/10',
  },
]

export function CheckDimensionsSection() {
  return (
    <Section spacing="marketing" id="what-it-checks" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-12 sm:space-y-16">
        <LandingSectionHeader
          label="WHAT FIXFLAGS CHECKS"
          headline="Every product breaks in four places."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {DIMENSIONS.map((d) => (
            <Card
              key={d.id}
              className={cn(
                'group flex h-full flex-col border p-6 shadow-md transition-all duration-300 hover:shadow-xl',
                d.border,
                d.glow
              )}
            >
              <span className={cn('mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl', d.iconBg)}>
                <d.Icon className={cn('h-5 w-5', d.iconColor)} aria-hidden />
              </span>
              <p className={cn('text-sm font-bold uppercase tracking-wide', d.iconColor)}>
                {d.title}
              </p>
              <p className="mt-2 text-base font-semibold leading-snug text-balance">
                {d.question}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                {d.body}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}
