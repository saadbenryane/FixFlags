import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { RoastClient } from '@/components/marketing/tools/RoastClient'
import { buildIndexableMetadata } from '@/lib/marketing/metadata'
import { ROAST_SEO } from '@/lib/marketing/copy'

export const metadata = buildIndexableMetadata({
  title: ROAST_SEO.title,
  description: ROAST_SEO.description,
  path: '/roast',
  robots: { index: false, follow: false },
})

export default function RoastPage() {
  return (
    <Section spacing="marketing">
      <Container variant="narrow" className="space-y-8">
        <RoastClient />
      </Container>
    </Section>
  )
}
