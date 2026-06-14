import Link from 'next/link'
import { DIFFERENTIATION } from '@/lib/marketing/copy'

const LIGHTHOUSE_DOCS = 'https://developer.chrome.com/docs/lighthouse'

export function LighthouseCallout({ className }: { className?: string }) {
  return (
    <p className={className}>
      {DIFFERENTIATION.subhead}{' '}
      <Link href="/#lighthouse-comparison" className="text-primary link-underline-grow">
        See full comparison
      </Link>{' '}
      or{' '}
      <a
        href={LIGHTHOUSE_DOCS}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary link-underline-grow"
      >
        Google Lighthouse docs
      </a>
      .
    </p>
  )
}
