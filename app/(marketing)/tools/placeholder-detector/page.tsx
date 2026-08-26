import { PlaceholderDetectorClient } from '@/components/marketing/tools/PlaceholderDetectorClient'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SEO } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { toolPageStructuredData } from '@/lib/marketing/structured-data'

export const metadata = buildPageMetadata('placeholderDetector', '/tools/placeholder-detector')

const jsonLd = toolPageStructuredData({
  path: '/tools/placeholder-detector',
  name: SEO.placeholderDetector.title,
  description: SEO.placeholderDetector.description,
})

export default function PlaceholderDetectorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Section spacing="marketing">
        <Container variant="narrow" className="space-y-8">
          <main>
            <PlaceholderDetectorClient />
          </main>
        </Container>
      </Section>
    </>
  )
}
