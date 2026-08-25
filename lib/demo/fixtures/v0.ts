import type { DemoFixture } from '@/lib/demo/types'
import { originalFixture } from '@/lib/demo/fixtures/original'

/** Earlier baseline used by the curated Review history. */
export const v0Fixture: DemoFixture = {
  ...originalFixture,
  slug: '',
  versionLabel: 'v0',
  path: '/demo?baseline=1',
  announcement:
    'Move faster with AI release notes, automated checks, launch analytics, and everything your team needs to ship.',
  headline: 'Move fast and ship more',
}
