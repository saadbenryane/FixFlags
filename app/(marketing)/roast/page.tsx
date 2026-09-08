import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { RoastClient } from '@/components/marketing/tools/RoastClient'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('roast', '/roast')

export default function RoastPage() {
  return (
    <Section spacing="marketing">
      <Container variant="narrow" className="space-y-8">
        <RoastClient />
      </Container>
    </Section>
  )
}
