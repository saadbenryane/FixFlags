import type { DemoFixture, DemoFixtureSlug } from '@/lib/demo/types'
import { originalFixture } from '@/lib/demo/fixtures/original'
import { v1Fixture } from '@/lib/demo/fixtures/v1'

const FIXTURES: Record<DemoFixtureSlug, DemoFixture> = {
  '': originalFixture,
  v1: v1Fixture,
}

export const DEMO_FIXTURE_VERSIONS = [
  { slug: '' as const, label: 'original', path: '/demo' },
  { slug: 'v1' as const, label: 'v1', path: '/demo/v1' },
] as const

export function resolveDemoFixture(slug: DemoFixtureSlug): DemoFixture {
  return FIXTURES[slug]
}
