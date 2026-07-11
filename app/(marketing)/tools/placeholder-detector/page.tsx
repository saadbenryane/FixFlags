import { TOOLS } from '@/lib/marketing/copy'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PlaceholderDetectorClient } from '@/components/marketing/tools/PlaceholderDetectorClient'

export function generateMetadata() {
  const seo = TOOLS.placeholderDetector
  return {
    title: `${seo.heading} – FixFlags`,
    description: seo.subhead,
  }
}

export default function PlaceholderDetectorPage() {
  return (
    <Section spacing="marketing">
      <Container variant="narrow" className="space-y-8">
        <PlaceholderDetectorClient />
      </Container>
    </Section>
  )
}
