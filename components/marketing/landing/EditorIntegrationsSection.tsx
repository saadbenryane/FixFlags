import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function EditorIntegrationsSection() {
  const { headline, body } = LANDING_PAGE.editorIntegrations

  return (
    <Section
      spacing="marketing"
      id="integrations"
      className="scroll-mt-[var(--header-offset)] bg-muted/20"
    >
      <Container>
        <RevealOnView>
          <div className="mx-auto max-w-3xl space-y-8 text-center">
            <div className="space-y-3">
              <LandingSectionHeader headline={headline} />
              <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
                {body}
              </p>
            </div>
            <EditorToolMarks
              showLabel
              className="mx-auto max-w-4xl items-center [&_ul]:justify-center"
            />
          </div>
        </RevealOnView>
      </Container>
    </Section>
  )
}
