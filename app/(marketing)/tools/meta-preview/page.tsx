import { MetaPreviewClient } from '@/components/marketing/tools/MetaPreviewClient'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SEO } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { toolPageStructuredData } from '@/lib/marketing/structured-data'

export const metadata = buildPageMetadata('metaPreview', '/tools/meta-preview')

const jsonLd = toolPageStructuredData({
  path: '/tools/meta-preview',
  name: SEO.metaPreview.title,
  description: SEO.metaPreview.description,
})

export default function MetaPreviewPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Section spacing="marketing">
        <Container variant="narrow" className="space-y-8">
          <main>
            <MetaPreviewClient />
          </main>
        </Container>
      </Section>
    </>
  )
}
