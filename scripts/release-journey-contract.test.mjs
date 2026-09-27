import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import {
  JOURNEYS_BY_STAGE,
  KNOWN_RELEASE_JOURNEYS,
  PARKED_POWER_TOOL_JOURNEYS,
  REQUIRED_RELEASE_JOURNEYS,
} from './release-journeys.mjs'

/**
 * `npm run verify:release` trusts `release-journeys.mjs` completely:
 *
 * - `inspectPlaywrightJourneys` throws if the report contains a journey id that
 *   is not in `KNOWN_RELEASE_JOURNEYS`.
 * - `requireStageJourneys` throws if a stage owns a journey that is missing,
 *   skipped, or not passing.
 * - The final receipt gate throws if any `REQUIRED_RELEASE_JOURNEYS` entry has
 *   no PASS evidence.
 *
 * So a stale declaration is not a documentation bug: it fails the release run,
 * and a new journey that nobody declared fails it too. These assertions keep the
 * declaration and the real specs in step, which is the only thing that makes the
 * release journey lists trustworthy.
 */

const specDir = new URL('../e2e/', import.meta.url)
const specSource = readdirSync(specDir)
  .filter((name) => name.endsWith('.spec.ts'))
  .map((name) => readFileSync(new URL(name, specDir), 'utf8'))
  .join('\n')

const declaredJourneys = new Set(
  [...specSource.matchAll(/\[journey:([a-z0-9-]+)\]/g)].map((match) => match[1]),
)

describe('release journey contract', () => {
  it('declares a journey for every real journey and no journey that does not exist', () => {
    const missingTest = KNOWN_RELEASE_JOURNEYS.filter((id) => !declaredJourneys.has(id))
    const undeclared = [...declaredJourneys].filter((id) => !KNOWN_RELEASE_JOURNEYS.includes(id))
    assert.deepEqual(missingTest, [], 'declared release journey has no spec')
    assert.deepEqual(undeclared, [], 'spec journey is not declared for the release run')
  })

  it('never declares the same journey in two stages', () => {
    for (const [stage, ids] of Object.entries(JOURNEYS_BY_STAGE)) {
      const others = Object.entries(JOURNEYS_BY_STAGE).filter(([name]) => name !== stage)
      const claimed = ids.filter((id) => others.some(([, list]) => list.includes(id)))
      assert.deepEqual(claimed, [], `${stage} shares a journey with another stage`)
    }
  })

  it('assigns every required journey to exactly one stage', () => {
    const staged = Object.values(JOURNEYS_BY_STAGE).flat()
    assert.deepEqual(
      REQUIRED_RELEASE_JOURNEYS.filter((id) => !staged.includes(id)),
      [],
      'required journey is never run by any stage',
    )
    assert.deepEqual(
      staged.filter((id) => !REQUIRED_RELEASE_JOURNEYS.includes(id)),
      [],
      'a stage runs a journey that is not required',
    )
  })

  it('keeps parked power-tool journeys out of the required release set', () => {
    for (const id of PARKED_POWER_TOOL_JOURNEYS) {
      assert.equal(REQUIRED_RELEASE_JOURNEYS.includes(id), false, `${id} must not block the web release`)
    }
  })
})
