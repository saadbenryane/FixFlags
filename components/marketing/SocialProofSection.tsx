import { SOCIAL_PROOF } from '@/lib/marketing/copy'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Badge } from '@/components/ui/badge'

export function SocialProofSection() {
  return (
    <Section spacing="default" className="bg-muted/35">
      <Container>
        <div className="space-y-8">
          <div className="space-y-3 text-center">
            <p className="font-display text-xl tracking-display text-balance sm:text-2xl">
              {SOCIAL_PROOF.headline}
            </p>
            <p className="font-mono text-xs uppercase tracking-label text-muted-foreground">
              {SOCIAL_PROOF.toolingLine}
            </p>
          </div>

          <div className="mx-auto max-w-prose">
            <div className="relative rounded-card border-0 bg-card p-6 shadow-card sm:p-8">
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
                  <Badge variant="outline" className="mb-2 text-[10px] font-mono uppercase tracking-label">
                    {SOCIAL_PROOF.testimonial.label}
                  </Badge>
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
