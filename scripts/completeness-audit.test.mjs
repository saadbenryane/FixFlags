import test from 'node:test'
import assert from 'node:assert/strict'
import { collectMcpTools, runCompletenessAudit } from './completeness-audit.mjs'

test('collectMcpTools extracts registered names without prose references', () => {
  assert.deepEqual(collectMcpTools("server.tool(\n 'ff_one', x)\n// ff_fake\nserver.tool('generate-two', y)"), ['ff_one', 'generate-two'])
})

test('repository completeness contracts are internally consistent', () => {
  const result = runCompletenessAudit()
  assert.deepEqual(result.failures, [])
})
