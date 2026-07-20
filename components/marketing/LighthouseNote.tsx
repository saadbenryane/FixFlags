import { DIFFERENTIATION, HELP_CENTER } from '@/lib/marketing/copy'
import { TextLink } from '@/components/ui/text-link'
import { helpHrefForSurface } from '@/lib/help/contextual'

const LIGHTHOUSE_DOCS = 'https://developer.chrome.com/docs/lighthouse'

export function LighthouseNote({ className }: { className?: string }) {
  return (
    <p className={className}>
      {DIFFERENTIATION.subhead}{' '}
      <TextLink href={helpHrefForSurface('lighthouse')}>{HELP_CENTER.label}</TextLink> or{' '}
      <TextLink href={LIGHTHOUSE_DOCS} target="_blank" rel="noopener noreferrer">
        Google Lighthouse docs
      </TextLink>
      .
    </p>
  )
}
