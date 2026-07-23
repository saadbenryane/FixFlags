import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { ACCURACY_HTML_FIXTURES } from '../accuracy-corpus'
import { runAccuracyFixtureChecks } from '../fixture-html'
import { rankFlagsByPriority, type RankableFlag } from '../priority-flags'

/**
 * Vitest mirror of the offline accuracy corpus. Expectations live in
 * `lib/audit/accuracy-corpus.ts`; this file asserts top-3 quality only.
 */

describe('report quality eval: top-3 ranking', () => {
  for (const fixture of ACCURACY_HTML_FIXTURES) {
    if (fixture.tier === 'control') continue

    it(`${fixture.file} top-3 are correct and distinct`, async () => {
      const { flags } = await runAccuracyFixtureChecks(fixture)
      const sorted = [...flags].sort((a, b) => a.checkId.localeCompare(b.checkId)) as RankableFlag[]
      const ranked = rankFlagsByPriority(sorted, [], 3)
      const top3Ids = ranked.map((r) => r.flag.checkId ?? '')

      assert.equal(
        new Set(top3Ids).size,
        top3Ids.length,
        `top-3 has duplicates: ${top3Ids.join(', ')}`
      )

      for (const expected of fixture.expectedTop3) {
        assert.ok(
          top3Ids.includes(expected),
          `Expected ${expected} in top-3 but got: ${top3Ids.join(', ')}. Full flags: ${flags.map((f) => `${f.severity}:${f.checkId}`).join(', ')}`
        )
      }
    })

    it(`${fixture.file} has no known false positives`, async () => {
      const { flags } = await runAccuracyFixtureChecks(fixture)
      const flagIds = new Set(flags.map((f) => f.checkId))

      for (const fp of fixture.knownFalsePositives) {
        assert.ok(
          !flagIds.has(fp),
          `Known false positive ${fp} still present. All flags: ${[...flagIds].join(', ')}`
        )
      }
    })

    it(`${fixture.file} has expected flags present`, async () => {
      const { flags } = await runAccuracyFixtureChecks(fixture)
      const flagIds = new Set(flags.map((f) => f.checkId))

      for (const expected of fixture.expectedPresent) {
        assert.ok(
          flagIds.has(expected),
          `Expected flag ${expected} not found. All flags: ${[...flagIds].join(', ')}`
        )
      }
    })
  }
})
