import { ToolEducation } from '@/components/marketing/tools/ToolEducation'
import { BrokenLinkCheckerClient } from '@/components/marketing/tools/BrokenLinkCheckerClient'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SEO } from '@/lib/marketing/copy-barrel'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { toolPageStructuredData } from '@/lib/marketing/structured-data'

export const metadata = buildPageMetadata('brokenLinks', '/tools/broken-link-checker')

const jsonLd = toolPageStructuredData({ path: '/tools/broken-link-checker', name: SEO.brokenLinks.title, description: SEO.brokenLinks.description })

export default function BrokenLinkCheckerPage() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <Section spacing="marketing">
      <Container variant="narrow" className="space-y-8">
        <main>
          <BrokenLinkCheckerClient />
          <ToolEducation tool="broken-links" />
        </main>
      </Container>
    </Section>
  </>
}
