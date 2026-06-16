import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function LogoCloudSection() {
  const { label, logos } = LANDING_PAGE.logoCloud

  return (
    <Section spacing="compact" className="py-12 sm:py-14">
      <Container>
        <p className="text-center font-mono text-[11px] uppercase tracking-label text-muted-foreground">
          {label}
        </p>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-10 lg:gap-x-12">
          {logos.map((name) => (
            <li
              key={name}
              className="font-sans text-sm font-semibold tracking-tight text-muted-foreground/60 sm:text-base"
            >
              {name}
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  )
}
