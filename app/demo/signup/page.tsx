import type { Metadata } from 'next'
import { DemoSignup } from '@/components/demo/DemoSignup'
import { resolveDemoFixture } from '@/lib/demo/resolve-fixture'

const fixture = resolveDemoFixture('')

export const metadata: Metadata = {
  title: `${fixture.metadata.title} — Sign up`,
  robots: { index: false, follow: false },
}

export default function DemoSignupPage() {
  return <DemoSignup fixture={fixture} />
}
