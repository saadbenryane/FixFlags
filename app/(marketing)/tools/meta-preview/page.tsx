import { TOOLS } from '@/lib/marketing/copy'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { MetaPreviewClient } from '@/components/marketing/tools/MetaPreviewClient'

export function generateMetadata() {
  const seo = TOOLS.metaPreview
  return {
    title: `${seo.heading} – FixFlags`,
    description: seo.subhead,
  }
}

export default function MetaPreviewPage() {
  return (
    <Section spacing="marketing">
      <Container variant="narrow" className="space-y-8">
        <MetaPreviewClient />
      </Container>
    </Section>
  )
}
