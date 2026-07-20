import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { RoastClient } from '@/components/marketing/tools/RoastClient'

export function generateMetadata() {
  return {
    title: 'Website Roast - FixFlags',
    description:
      'Get a blunt quality check across Message, Experience, and Reach. Paste a URL, get a grade, then fix what matters.',
    openGraph: {
      title: 'Website Roast - FixFlags',
      description: 'Paste your URL. Get roasted. Fix what matters.',
      type: 'website',
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
