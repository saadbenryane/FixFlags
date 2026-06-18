import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'

const TESTIMONIALS = [
  {
    quote:
      "FixFlags catches the stuff I always miss before launch. It's like having a senior PM and QA in the loop.",
    name: 'Theo Browne',
    role: 'Indie Hacker',
    initials: 'TB',
    avatarBg: 'bg-brand',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-label="X / Twitter">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.258 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
      </svg>
    ),
    iconColor: 'text-foreground',
  },
  {
    quote:
      "We run FixFlags before every release. It's now part of our deployment checklist.",
    name: 'Sarah Chen',
    role: 'Founder, early-stage SaaS',
    initials: 'SC',
    avatarBg: 'bg-foreground',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-label="LinkedIn">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    iconColor: 'text-foreground',
  },
  {
    quote:
      "The agent-ready fixes save hours. It tells Cursor exactly what to do.",
    name: 'Kevin Lu',
    role: 'Full-stack Developer',
    initials: 'KL',
    avatarBg: 'bg-muted-foreground',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-label="GitHub">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
    iconColor: 'text-foreground',
  },
]

export function TestimonialsSection() {
  return (
    <Section
      spacing="marketing"
      id="testimonials"
      className="scroll-mt-[var(--header-offset)] bg-muted/20"
    >
      <Container className="space-y-8 sm:space-y-11">
        <LandingSectionHeader
          label="LOVED BY BUILDERS"
          headline="Built for developers shipping fast."
        />

        <div className="grid gap-5 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col justify-between rounded-card border border-border/50 bg-card p-6 shadow-md transition-shadow hover:shadow-lg"
            >
              {/* quote */}
              <blockquote className="text-sm leading-relaxed text-foreground/80">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              {/* author */}
              <div className="mt-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${t.avatarBg}`}>
                    {t.initials}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
                <span className={t.iconColor} aria-hidden>{t.icon}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm font-medium text-muted-foreground">
          Join 2,000+ builders who ship with confidence.
        </p>
      </Container>
    </Section>
  )
}
