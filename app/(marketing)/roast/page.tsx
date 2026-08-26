import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { RoastClient } from '@/components/marketing/tools/RoastClient'
import { ROAST_META } from '@/lib/marketing/copy'
import { DEFAULT_OG_IMAGE } from '@/lib/marketing/metadata'

export function generateMetadata() {
  return {
    title: ROAST_META.title,
    description: ROAST_META.description,
    openGraph: {
      title: ROAST_META.title,
      description: ROAST_META.ogDescription,
      type: 'website',
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: ROAST_META.title,
      description: ROAST_META.ogDescription,
      images: [DEFAULT_OG_IMAGE.url],
    },
  }
}

export default function RoastPage() {
  return (
    <Section spacing="marketing">
      <Container variant="narrow" className="space-y-8">
        <RoastClient />
      </Container>
    </Section>
  )
}
