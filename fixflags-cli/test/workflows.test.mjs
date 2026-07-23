import assert from 'node:assert/strict'
import test from 'node:test'

import { checkAndPlan, recheckAndDiff } from '../dist/workflows.js'

function caller(responses) {
  const calls = []
  return {
    calls,
    call: async (tool, args) => {
      calls.push({ tool, args })
      const response = responses[tool]
      if (Array.isArray(response)) return response.shift()
      if (response instanceof Error) throw response
      return response
    },
  }
}

test('checkAndPlan prefers the complete fix list while retaining the legacy plan', async () => {
  const mock = caller({
    ff_check_and_plan: {
      reportId: 'report-1',
      reportUrl: 'https://fixflags.com/report/report-1',
      status: 'COMPLETED',
      score: 82,
      verdict: 'Clear path, weak proof',
      rubrics: [{ name: 'MESSAGE', criticalCount: 0 }],
      fixList: {
        reportId: 'report-1',
        totalCount: 2,
        items: [
          { problem: 'CTA is vague', rubric: 'MESSAGE', severity: 'IMPORTANT' },
          { problem: 'Proof is missing', rubric: 'MESSAGE', severity: 'POLISH' },
        ],
      },
      finishPlan: {
        reportId: 'report-1',
        items: [{ problem: 'CTA is vague', rubric: 'MESSAGE', severity: 'IMPORTANT' }],
      },
    },
  })

  const result = await checkAndPlan(mock.call, 'https://example.com', {
    wait: true,
    single: false,
    apiBase: 'https://fixflags.com',
  })

  assert.equal(result.reportId, 'report-1')
  assert.equal(result.score, 82)
  assert.equal(result.fixList.items.length, 2)
  assert.equal(result.finishPlan.items.length, 1)
  assert.deepEqual(mock.calls.map((item) => item.tool), ['ff_check_and_plan'])
  assert.deepEqual(mock.calls[0].args, {
    url: 'https://example.com',
    waitForCompletion: true,
    mode: 'critical_path',
  })
})

test('checkAndPlan returns the authoritative queued outcome without coordinating extra calls', async () => {
  const mock = caller({
    ff_check_and_plan: { reportId: 'report-2', status: 'QUEUED' },
  })

  const result = await checkAndPlan(mock.call, 'https://example.com', {
    wait: false,
    single: true,
    apiBase: 'https://fixflags.com/',
  })

  assert.equal(result.status, 'QUEUED')
  assert.equal(result.reportUrl, 'https://fixflags.com/report/report-2')
  assert.equal(
    mock.calls.length,
    1
  )
})

test('checkAndPlan continues through status and completed report after the server wait window', async () => {
  const mock = caller({
    ff_check_and_plan: {
      reportId: 'report-running',
      reportUrl: 'https://fixflags.com/report/report-running',
      status: 'CHECKING',
    },
    ff_get_check_status: [{ reportId: 'report-running', status: 'CHECKING' }, { reportId: 'report-running', status: 'COMPLETED' }],
    ff_get_report: {
      reportId: 'report-running',
      reportUrl: 'https://fixflags.com/report/report-running',
      status: 'COMPLETED',
      finishPlan: { reportId: 'report-running', items: [] },
    },
  })

  const result = await checkAndPlan(mock.call, 'https://example.com', {
    wait: true,
    single: false,
    apiBase: 'https://fixflags.com',
    pollIntervalMs: 0,
    maxWaitMs: 100,
  })
  assert.equal(result.status, 'COMPLETED')
  assert.deepEqual(mock.calls.map((item) => item.tool), [
    'ff_check_and_plan', 'ff_get_check_status', 'ff_get_check_status', 'ff_get_report',
  ])
})

test('recheckAndDiff uses the combined monitoring response without extra calls', async () => {
  const mock = caller({
    ff_recheck_and_compare: {
      parentReportId: 'parent-1',
      reportId: 'child-1',
      reportUrl: 'https://fixflags.com/report/child-1',
      status: 'COMPLETED',
      nextFixList: {
        reportId: 'child-1',
        totalCount: 2,
        items: [
          { problem: 'Proof remains weak', rubric: 'MESSAGE', severity: 'IMPORTANT', fixPrompt: 'Add product evidence.' },
          { problem: 'Mobile spacing remains tight', rubric: 'EXPERIENCE', severity: 'POLISH', fixPrompt: 'Increase spacing.' },
        ],
      },
      diff: { fixed: 2, remaining: 1, newIssues: 0, regressed: 0 },
      nextFinishPlan: {
        reportId: 'child-1',
        items: [{ problem: 'Proof remains weak', rubric: 'MESSAGE', severity: 'IMPORTANT', fixPrompt: 'Add product evidence.' }],
      },
    },
  })

  const result = await recheckAndDiff(mock.call, 'parent-1', {
    wait: true,
  })

  assert.deepEqual(result.diff, { fixed: 2, remaining: 1, newIssues: 0, regressed: 0 })
  assert.equal(result.nextFixList.items.length, 2)
  assert.equal(result.nextFinishPlan.items.length, 1)
  assert.deepEqual(mock.calls.map((item) => item.tool), ['ff_recheck_and_compare'])
})

test('recheckAndDiff rejects a malformed authoritative outcome', async () => {
  const mock = caller({
    ff_recheck_and_compare: { status: 'COMPLETED' },
  })

  await assert.rejects(
    recheckAndDiff(mock.call, 'parent-2', { wait: true }),
    /reportId must be a non-empty string/
  )
  assert.deepEqual(mock.calls.map((item) => item.tool), ['ff_recheck_and_compare'])
})
