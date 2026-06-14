import { SOCIAL_PROOF } from '@/lib/marketing/copy'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'

function LogoPlaceholder({ name }: { name: string }) {
  const colors = [
    'from-brand/20 to-brand/5',
    'from-sky-500/20 to-sky-500/5',
    'from-violet-500/20 to-violet-500/5',
    'from-amber-500/20 to-amber-500/5',
    'from-emerald-500/20 to-emerald-500/5',
    'from-rose-500/20 to-rose-500/5',
  ]
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const gradient = colors[hash % colors.length]

  return (
    <div
      className={`flex h-10 items-center justify-center rounded-md bg-gradient-to-br ${gradient} px-4`}
    >
      <span className="font-mono text-xs font-semibold tracking-tight text-muted-foreground">
        {name}
      </span>
    </div>
  )
}

export function SocialProofSection() {
  return (
    <Section spacing="tight">
      <Container>
        <div className="space-y-10">
          <div className="space-y-4 text-center">
            <p className="text-sm font-medium text-foreground">{SOCIAL_PROOF.headline}</p>
            <p className="text-xs text-muted-foreground">{SOCIAL_PROOF.toolingLine}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {SOCIAL_PROOF.logos.map((logo) => (
                <LogoPlaceholder key={logo.name} name={logo.name} />
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-2xl">
            <div className="relative rounded-card border border-border/20 bg-card p-6 shadow-card sm:p-8">
              <svg
                className="absolute top-4 left-4 h-8 w-8 text-brand/15"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.69 11 13.124 11 15c0 1.93-1.57 3.5-3.5 3.5-1.797 0-3.157-1.319-2.917-3.179zm10.5 0C14.053 16.227 13.5 15 13.5 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C20.091 11.69 21.5 13.124 21.5 15c0 1.93-1.57 3.5-3.5 3.5-1.797 0-3.157-1.319-2.917-3.179z" />
              </svg>
              <div className="relative space-y-3">
                <p className="text-sm leading-relaxed text-foreground/85 text-pretty italic">
                  &ldquo;{SOCIAL_PROOF.testimonial.quote}&rdquo;
                </p>
                <div>
                  <p className="text-sm font-semibold">{SOCIAL_PROOF.testimonial.author}</p>
                  <p className="text-xs text-muted-foreground">{SOCIAL_PROOF.testimonial.company}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
