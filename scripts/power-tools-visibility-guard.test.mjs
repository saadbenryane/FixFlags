import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PARKED_PUBLIC_PREFIXES,
  powerToolVisibilityFailures,
} from './power-tools-visibility-guard.mjs'

function parkedProxy() {
  return `const PARKED = ${JSON.stringify(PARKED_PUBLIC_PREFIXES)}\nreturn new Response(null, { status: 404 })`
}

test('accepts retained implementations when every public prefix is parked and undiscoverable', () => {
  assert.deepEqual(powerToolVisibilityFailures({
    proxySource: parkedProxy(),
    discoverySources: {
      'lib/marketing/copy/homepage.ts': "export const promise = 'Review a live URL'",
    },
  }), [])
})

test('rejects missing route parking, inconsistent repository responses, and public links', () => {
  const failures = powerToolVisibilityFailures({
    proxySource: `${parkedProxy().replace('"/api/repo-scans"', '"/api/other"')}\nRepository scanning is not currently available`,
    discoverySources: {
      'lib/docs/content.ts': "href: '/docs/cli'",
    },
  })
  assert.ok(failures.includes('Proxy does not park /api/repo-scans'))
  assert.ok(failures.some((failure) => failure.includes('same not-found boundary')))
  assert.ok(failures.some((failure) => failure.includes('links to a parked')))
})

test('allows the waitlist logged-in review line on pricing copy without setup-route links', () => {
  assert.deepEqual(powerToolVisibilityFailures({
    proxySource: parkedProxy(),
    discoverySources: {
      'lib/marketing/copy/plans.ts':
        "features: ['This page and every public page it links to', 'Logged-in review on your computer']",
    },
  }), [])
})

test('still rejects parked setup routes next to the waitlist logged-in line', () => {
  const failures = powerToolVisibilityFailures({
    proxySource: parkedProxy(),
    discoverySources: {
      'lib/marketing/copy/plans.ts':
        "features: ['Logged-in review on your computer']\nhref: '/docs/cli'",
    },
  })
  assert.ok(failures.some((failure) => failure.includes('links to a parked')))
})
