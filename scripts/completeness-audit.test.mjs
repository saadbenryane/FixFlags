import test from 'node:test'
import assert from 'node:assert/strict'
import {
  collectMcpToolManifest,
  collectMcpTools,
  collectRegisteredMcpToolKeys,
  runCompletenessAudit,
} from './completeness-audit.mjs'

test('collectMcpTools extracts registered names without prose references', () => {
  assert.deepEqual(collectMcpTools("server.tool(\n 'ff_one', x)\n// ff_fake\nserver.tool('generate-two', y)"), ['ff_one', 'generate-two'])
})

test('typed MCP manifest and registrations expose stable keys', () => {
  const manifest = collectMcpToolManifest(`export const MCP_TOOLS = {
  checkAndPlan: {
    name: 'ff_check_and_plan',
    desc: 'Check.',
  },
} as const`)
  assert.deepEqual([...manifest], [['checkAndPlan', 'ff_check_and_plan']])
  assert.deepEqual(
    collectRegisteredMcpToolKeys('server.tool(MCP_TOOLS.checkAndPlan.name, MCP_TOOLS.checkAndPlan.desc, {})'),
    ['checkAndPlan'],
  )
})

test('repository completeness contracts are internally consistent', () => {
  const result = runCompletenessAudit()
  assert.deepEqual(result.failures, [])
})
