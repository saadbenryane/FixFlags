import { DIFFERENTIATION } from '@/lib/marketing/copy'
import { TextLink } from '@/components/ui/text-link'

const LIGHTHOUSE_DOCS = 'https://developer.chrome.com/docs/lighthouse'

export function LighthouseCallout({ className }: { className?: string }) {
  return (
    <p className={className}>
      {DIFFERENTIATION.subhead}{' '}
      <TextLink href="/faq">See FAQ</TextLink> or{' '}
      <TextLink href={LIGHTHOUSE_DOCS} target="_blank" rel="noopener noreferrer">
        Google Lighthouse docs
      </TextLink>
      .
    </p>
  )
}
