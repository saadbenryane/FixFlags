import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function LogoCloudSection() {
  const { label, logos } = LANDING_PAGE.logoCloud

  return (
    <Section spacing="compact" className="border-y border-border/30 bg-muted/20 py-10 sm:py-12">
      <Container>
        <p className="text-center font-mono text-[11px] uppercase tracking-label text-muted-foreground">
          {label}
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-10 lg:gap-x-12">
          {logos.map((name) => (
            <li
              key={name}
              className="font-sans text-sm font-semibold tracking-tight text-muted-foreground/70 sm:text-base"
            >
              {name}
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  )
}
