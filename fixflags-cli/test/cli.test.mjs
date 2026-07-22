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

test('built CLI completes check and recheck task-shaped workflows', async (t) => {
  const tools = []
  const server = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => {
      const rpc = JSON.parse(body)
      const tool = rpc.params.name
      tools.push(tool)

      const values = {
        ff_check_and_plan: {
          reportId: 'report-1',
          reportUrl: 'http://example.test/report/report-1',
          status: 'COMPLETED',
          score: 84,
          verdict: 'One important improvement remains',
          rubrics: [{ name: 'MESSAGE', criticalCount: 0 }],
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
          nextFinishPlan: { reportId: 'report-2', items: [] },
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
  assert.match(checked.stdout, /fixflags recheck report-1/)

  const rechecked = await runCli(
    ['recheck', 'report-1', '--wait', '--diff'],
    apiUrl
  )
  assert.equal(rechecked.code, 0, rechecked.stderr)
  assert.match(rechecked.stdout, /Fixed: 1/)
  assert.match(rechecked.stdout, /Finish Plan: 0 unresolved improvements/)

  assert.deepEqual(tools, [
    'ff_check_and_plan',
    'ff_recheck_and_compare',
  ])
})

test('built CLI no-argument view is live, compact, and successful', async () => {
  const result = await runCli([], 'https://fixflags.test')
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /service: FixFlags/)
  assert.match(result.stdout, /authenticated: yes/)
  assert.match(result.stdout, /check <url>/)
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
