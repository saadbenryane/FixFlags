import type { Metadata } from 'next'
import { DemoSignup } from '@/components/demo/DemoSignup'
import { resolveDemoFixture } from '@/lib/demo/resolve-fixture'

const fixture = resolveDemoFixture('v1')

export const metadata: Metadata = {
  title: `${fixture.metadata.title} - Sign up`,
  robots: { index: false, follow: false },
}

export default function DemoV1SignupPage() {
  return <DemoSignup fixture={fixture} />
}
