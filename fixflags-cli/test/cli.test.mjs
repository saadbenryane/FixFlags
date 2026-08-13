import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import test from 'node:test'

function runCli(args, apiUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['bin/fixflags.js', ...args], {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        FIXFLAGS_API_KEY: 'ff_live_test',
        FIXFLAGS_API_URL: apiUrl,
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function runMcpBridge(request, apiUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['bin/fixflags.js', 'mcp'], {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        FIXFLAGS_API_KEY: 'ff_live_test',
        FIXFLAGS_API_URL: apiUrl,
        NO_COLOR: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
    child.stdin.end(`${JSON.stringify(request)}\n`)
  })
}

test('built CLI completes check and recheck task-shaped workflows', async (t) => {
  const tools = []
  const calls = []
  const server = createServer((request, response) => {
    assert.match(request.headers.accept ?? '', /application\/json/)
    assert.match(request.headers.accept ?? '', /text\/event-stream/)
    let body = ''
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => {
      const rpc = JSON.parse(body)
      const tool = rpc.params.name
      tools.push(tool)
      calls.push({ tool, args: rpc.params.arguments })

      const values = {
        ff_check_and_plan: {
          reportId: 'report-1',
          reportUrl: 'http://example.test/report/report-1',
          status: 'COMPLETED',
          score: 84,
          verdict: 'One important improvement remains',
          rubrics: [{ name: 'MESSAGE', criticalCount: 0 }],
          fixList: {
            reportId: 'report-1',
            totalCount: 2,
            items: [
              {
                problem: 'CTA is vague',
                rubric: 'MESSAGE',
                severity: 'IMPORTANT',
                fixPrompt: 'Name the user outcome in the CTA.',
              },
              {
                problem: 'Proof is missing',
                rubric: 'MESSAGE',
                severity: 'POLISH',
                fixPrompt: 'Add substantiated proof near the CTA.',
              },
            ],
          },
          finishPlan: {
            reportId: 'report-1',
            items: [{
              problem: 'CTA is vague',
              rubric: 'MESSAGE',
              severity: 'IMPORTANT',
              fixPrompt: 'Name the user outcome in the CTA.',
            }],
          },
        },
        ff_recheck_and_compare: {
          parentReportId: 'report-1',
          reportId: 'report-2',
          reportUrl: 'http://example.test/report/report-2',
          status: 'COMPLETED',
          diff: { fixed: 1, remaining: 0, newIssues: 0, regressed: 0 },
          nextFixList: { reportId: 'report-2', totalCount: 0, items: [] },
          nextFinishPlan: { reportId: 'report-2', items: [] },
        },
        ff_mark_fix_attempted: {
          flagId: 'flag-1',
          action: 'READY_TO_VERIFY',
          productId: 'product-1',
          improvementId: 'improvement-1',
          attemptId: 'attempt-1',
          sourceReviewId: 'report-1',
          nextAction: {
            type: 'RUN_UPDATE_REVIEW',
            reportId: 'report-1',
            command: 'fixflags recheck report-1 --wait --diff',
          },
        },
      }

      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        jsonrpc: '2.0',
        id: rpc.id,
        result: { content: [{ type: 'text', text: JSON.stringify(values[tool]) }] },
      }))
    })
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const address = server.address()
  const apiUrl = `http://127.0.0.1:${address.port}`

  const checked = await runCli(
    ['check', 'https://example.com', '--wait', '--plan'],
    apiUrl
  )
  assert.equal(checked.code, 0, checked.stderr)
  assert.match(checked.stdout, /Finish Plan \(1\)/)
  assert.match(checked.stdout, /CTA is vague/)
  assert.doesNotMatch(checked.stdout, /Proof is missing/)
  assert.match(checked.stdout, /fixflags recheck report-1/)

  const allFixes = await runCli(
    ['check', 'https://example.com', '--wait', '--all'],
    apiUrl
  )
  assert.equal(allFixes.code, 0, allFixes.stderr)
  assert.match(allFixes.stdout, /Complete Fix List \(2\)/)
  assert.match(allFixes.stdout, /CTA is vague/)
  assert.match(allFixes.stdout, /Proof is missing/)

  const attempted = await runCli(
    [
      'attempt',
      'flag-1',
      '--summary',
      'Clarified the primary CTA.',
      '--deployment',
      'https://example.com/releases/42',
    ],
    apiUrl
  )
  assert.equal(attempted.code, 0, attempted.stderr)
  assert.match(attempted.stdout, /ready for independent verification/)
  assert.match(attempted.stdout, /Product: product-1/)
  assert.match(attempted.stdout, /Improvement: improvement-1/)
  assert.match(attempted.stdout, /Attempt: attempt-1/)
  assert.match(attempted.stdout, /Source Review: report-1/)
  assert.match(attempted.stdout, /Next action: RUN_UPDATE_REVIEW/)

  const rechecked = await runCli(
    ['recheck', 'report-1', '--wait', '--diff'],
    apiUrl
  )
  assert.equal(rechecked.code, 0, rechecked.stderr)
  assert.match(rechecked.stdout, /Improved: 1/)
  assert.match(rechecked.stdout, /Next Finish Plan: 0 unresolved improvements/)

  assert.deepEqual(tools, [
    'ff_check_and_plan',
    'ff_check_and_plan',
    'ff_mark_fix_attempted',
    'ff_recheck_and_compare',
  ])
  assert.deepEqual(calls[2], {
    tool: 'ff_mark_fix_attempted',
    args: {
      flagId: 'flag-1',
      action: 'READY_TO_VERIFY',
      changeSummary: 'Clarified the primary CTA.',
      deploymentReference: 'https://example.com/releases/42',
    },
  })
})

test('built CLI no-argument view is live, compact, and successful', async () => {
  const result = await runCli([], 'https://fixflags.test')
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /service: FixFlags/)
  assert.match(result.stdout, /authenticated: yes/)
  assert.match(result.stdout, /check <url>/)
  assert.match(result.stdout, /attempt <flagId>/)
  assert.doesNotMatch(result.stdout, /Usage:/)
})

test('built CLI returns structured errors in JSON mode', async () => {
  const result = await runCli(['status', 'missing', '--json'], 'http://127.0.0.1:1')
  assert.equal(result.code, 1)
  const payload = JSON.parse(result.stderr)
  assert.equal(payload.error.code, 'FIXFLAGS_ERROR')
  assert.ok(payload.error.message)
  assert.ok(payload.error.recovery)
})

test('local MCP bridge uses CLI authentication without writing a project secret', async (t) => {
  const server = createServer((request, response) => {
    assert.equal(request.headers.authorization, 'Bearer ff_live_test')
    assert.match(request.headers.accept ?? '', /application\/json/)
    assert.match(request.headers.accept ?? '', /text\/event-stream/)
    let body = ''
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => {
      const rpc = JSON.parse(body)
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        jsonrpc: '2.0',
        id: rpc.id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'fixflags', version: '0.2.0-beta.1' },
        },
      }))
    })
  })
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  t.after(() => server.close())
  const address = server.address()
  const result = await runMcpBridge(
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      },
    },
    `http://127.0.0.1:${address.port}`
  )
  assert.equal(result.code, 0, result.stderr)
  const response = JSON.parse(result.stdout)
  assert.equal(response.result.serverInfo.name, 'fixflags')
  assert.doesNotMatch(result.stdout + result.stderr, /ff_live_test/)
})
