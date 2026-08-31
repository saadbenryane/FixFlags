import { describe, expect, it } from 'vitest'
import { ACCURACY_HTML_FIXTURES } from '@/lib/audit/accuracy-corpus'
import { runAccuracyFixtureChecks } from '@/lib/audit/fixture-html'
import { observationIdentity } from '@/lib/audit/flag-identity'

function importantIdentities(flags: Array<{ checkId: string; problem: string; rubric: string; severity: string }>) {
  return flags
    .filter((flag) => flag.severity === 'CRITICAL' || flag.severity === 'IMPORTANT')
    .map((flag) => observationIdentity(flag))
    .sort()
}

describe('unchanged-site observation identity', () => {
  it('two runs of the same HTML fixture invent no new IMPORTANT identities', async () => {
    const fixture = ACCURACY_HTML_FIXTURES.find((item) => item.file === 'saadbenryane-com.html')
    expect(fixture).toBeTruthy()
    const first = await runAccuracyFixtureChecks(fixture!)
    const second = await runAccuracyFixtureChecks(fixture!)
    expect(importantIdentities(second.flags)).toEqual(importantIdentities(first.flags))
  })
})
