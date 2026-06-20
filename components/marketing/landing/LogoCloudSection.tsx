import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'

export function LogoCloudSection() {
  return (
    <Section spacing="compact" className="py-8 sm:py-10">
      <Container>
        <EditorToolMarks compact className="mx-auto max-w-3xl items-center text-center [&_ul]:justify-center" />
      </Container>
    </Section>
  )
}
