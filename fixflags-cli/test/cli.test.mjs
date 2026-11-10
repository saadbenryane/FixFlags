import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createInterface } from 'node:readline'
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

function runMcpBridge(request, apiUrl, onReply) {
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
    if (onReply) createInterface({ input: child.stdout }).on('line', line => onReply(JSON.parse(line)))
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
    if (typeof request === 'function') request(child.stdin)
    else child.stdin.end((Array.isArray(request) ? request : [request]).map(value => JSON.stringify(value)).join('\n') + '\n')
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
          siteUrl: 'http://example.test/sites/p_report-1',
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
          siteUrl: 'http://example.test/sites/p_report-2',
          status: 'COMPLETED',
          diff: {
            fixed: 1,
            noLongerObserved: 1,
            inconclusive: 0,
            remaining: 0,
            newIssues: 0,
            regressed: 0,
          },
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
  assert.match(rechecked.stdout, /No longer observed: 1/)
  assert.match(rechecked.stdout, /Inconclusive: 0/)
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
  assert.match(result.stdout, /outcomes <siteId>/)
  assert.match(result.stdout, /verify-outcome <siteId> <outcomeId>/)
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

for (const [command, args, tool] of [
  ['flags', ['site-1'], 'fixflags.list_flags'],
  ['record-fix', ['site-1', 'flag-1', 'Restored the action name'], 'fixflags.record_fix'],
  ['verify-flag', ['site-1', 'flag-1', 'attempt-1'], 'fixflags.verify_flag'],
]) {
  for (const format of ['structured', 'json-text', 'plain-text', 'event-stream']) {
    test(`built CLI fails a ${command} tool error returned with HTTP 200 (${format})`, async t => {
      const failure = { status: 'ERROR', error: { code: 'NOT_FOUND', message: 'Site not found', action: 'check_site_id' } }
      const server = createServer((request, response) => {
        let body = ''
        request.on('data', chunk => { body += chunk })
        request.on('end', () => {
          const rpc = JSON.parse(body)
          assert.equal(rpc.params.name, tool)
          response.writeHead(200, { 'content-type': format === 'event-stream' ? 'text/event-stream' : 'application/json' })
          const payload = JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: {
            isError: true, content: [{ type: 'text', text: format === 'plain-text' ? failure.error.message : JSON.stringify(failure) }],
            ...(format === 'structured' ? { structuredContent: failure } : {}),
          } })
          response.end(format === 'event-stream' ? `event: message\ndata: ${payload}\n\n` : payload)
        })
      })
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      t.after(() => new Promise(resolve => server.close(resolve)))
      const result = await runCli([command, ...args, '--json'], `http://127.0.0.1:${server.address().port}`)
      assert.equal(result.code, 1)
      assert.equal(result.stdout, '')
      assert.equal(JSON.parse(result.stderr).error.message, failure.error.message)
      assert.doesNotMatch(result.stderr, /ff_live_test/)
    })
  }
}

for (const encoding of ['json', 'event-stream']) test(`local MCP bridge uses CLI authentication without writing a project secret (${encoding})`, async (t) => {
  const server = createServer((request, response) => {
    assert.equal(request.headers.authorization, 'Bearer ff_live_test')
    assert.match(request.headers.accept ?? '', /application\/json/)
    assert.match(request.headers.accept ?? '', /text\/event-stream/)
    let body = ''
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => {
      const rpc = JSON.parse(body)
      response.writeHead(200, { 'content-type': encoding === 'json' ? 'application/json' : 'text/event-stream' })
      const payload = JSON.stringify({
        jsonrpc: '2.0',
        id: rpc.id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'fixflags', version: '0.2.0-beta.1' },
        },
      })
      response.end(encoding === 'json' ? payload : `event: message\ndata: ${payload}\n\n`)
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

test('local MCP bridge correlates an HTTP permission refusal with its stdio request', async t => {
  const server = createServer((_request, response) => {
    response.writeHead(403, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001,
      message: 'This credential cannot perform that action.', data: { code: 'INSUFFICIENT_SCOPE' } } }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const request = { jsonrpc: '2.0', id: 17, method: 'tools/call', params: { name: 'fixflags.record_fix', arguments: {} } }
  const result = await runMcpBridge(request, `http://127.0.0.1:${server.address().port}`)
  const reply = JSON.parse(result.stdout)
  assert.equal(reply.id, request.id)
  assert.equal(reply.error.data.code, 'INSUFFICIENT_SCOPE')
  assert.doesNotMatch(result.stdout + result.stderr, /ff_live_test/)
})

for (const [method, named] of [
  ['server/discover', {}],
  ['tools/call', { name: 'fixflags.list_sites', arguments: {} }],
  ['prompts/get', { name: '=?base64?literal?=' }],
  ['resources/read', { uri: 'https://example.com/café' }],
  ['tasks/get', { taskId: 'task-1' }],
  ['tasks/update', { taskId: ' task-2 ' }],
  ['tasks/cancel', { taskId: 'task-3' }],
]) test(`local MCP bridge mirrors the modern ${method} envelope into HTTP headers`, async t => {
  const request = { jsonrpc: '2.0', id: 31, method, params: { ...named,
    _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': { name: 'bridge-proof', version: '1' },
      'io.modelcontextprotocol/clientCapabilities': {} } } }
  const server = createServer((incoming, response) => {
    assert.equal(incoming.headers['mcp-protocol-version'], '2026-07-28')
    assert.equal(incoming.headers['mcp-method'], method)
    const name = named.name ?? named.uri ?? named.taskId
    const header = incoming.headers['mcp-name']
    if (name === undefined) assert.equal(header, undefined)
    else {
      const decoded = header.startsWith('=?base64?') && header.endsWith('?=')
        ? Buffer.from(header.slice(9, -2), 'base64').toString('utf8') : header
      assert.equal(decoded, name)
    }
    let body = ''
    incoming.on('data', chunk => { body += chunk })
    incoming.on('end', () => {
      assert.deepEqual(JSON.parse(body), request)
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {} }))
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const result = await runMcpBridge(request, `http://127.0.0.1:${server.address().port}`)
  assert.equal(result.code, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).id, request.id)
  assert.doesNotMatch(result.stdout + result.stderr, /ff_live_test/)
})

test('local MCP bridge returns an independent reply while an earlier request is held', async t => {
  let held, fallback, sendFollowing, independentReplyBeforeRelease = false
  const reply = (response, id) => response.writeHead(200, { 'content-type': 'application/json' })
    .end(JSON.stringify({ jsonrpc: '2.0', id, result: { id } }))
  const server = createServer((incoming, response) => {
    let body = ''
    incoming.on('data', chunk => { body += chunk })
    incoming.on('end', () => {
      const request = JSON.parse(body)
      if (request.id === 1) {
        held = response
        fallback = setTimeout(() => { held = undefined; reply(response, 1) }, 1500)
        sendFollowing()
      } else reply(response, request.id)
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { clearTimeout(fallback); server.closeAllConnections(); server.close() })
  const requests = [1, 2].map(id => ({ jsonrpc: '2.0', id, method: 'tools/list', params: {} }))
  const result = await runMcpBridge(input => {
    sendFollowing = () => input.end(JSON.stringify(requests[1]) + '\n')
    input.write(JSON.stringify(requests[0]) + '\n')
  }, `http://127.0.0.1:${server.address().port}`, message => {
    if (message.id === 2 && held) {
      independentReplyBeforeRelease = true
      clearTimeout(fallback)
      reply(held, 1)
      held = undefined
    }
  })
  assert.equal(independentReplyBeforeRelease, true)
  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(result.stdout.trim().split('\n').map(line => JSON.parse(line).id), [2, 1])
})

test('local MCP bridge bounds concurrent HTTP exchanges and drains every request on input closure', async t => {
  let active = 0, maximum = 0, received = 0, fallback, reachedCapacity = false, fallbackReleased = false
  const pending = []
  const finish = ([response, id]) => {
    active--
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id, result: {} }))
  }
  const server = createServer((incoming, response) => {
    let body = ''
    incoming.on('data', chunk => { body += chunk })
    incoming.on('end', () => {
      const request = JSON.parse(body)
      active++; received++; maximum = Math.max(maximum, active)
      pending.push([response, request.id])
      if (fallbackReleased) { finish(pending.pop()); return }
      if (received === 1) fallback = setTimeout(() => { fallbackReleased = true; while (pending.length) finish(pending.shift()) }, 1500)
      if (received === 8) { reachedCapacity = true; finish(pending.shift()) }
      if (received === 9) { clearTimeout(fallback); while (pending.length) finish(pending.shift()) }
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { clearTimeout(fallback); server.closeAllConnections(); server.close() })
  const requests = Array.from({ length: 9 }, (_, index) => ({ jsonrpc: '2.0', id: index + 1, method: 'tools/list', params: {} }))
  const result = await runMcpBridge(requests, `http://127.0.0.1:${server.address().port}`)
  assert.equal(reachedCapacity, true)
  assert.equal(maximum, 8)
  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(result.stdout.trim().split('\n').map(line => JSON.parse(line).id).sort((a, b) => a - b), requests.map(request => request.id))
})

test('local MCP bridge refuses an invalid frame without losing independent requests', async t => {
  const received = []
  const server = createServer((incoming, response) => {
    let body = ''
    incoming.on('data', chunk => { body += chunk })
    incoming.on('end', () => {
      const request = JSON.parse(body)
      received.push(request.id)
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {} }))
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const request = id => ({ jsonrpc: '2.0', id, method: 'tools/list', params: {} })
  const result = await runMcpBridge([request(1), null, request(2)], `http://127.0.0.1:${server.address().port}`)
  assert.equal(result.code, 0, result.stderr)
  const replies = result.stdout.trim().split('\n').map(line => JSON.parse(line))
  assert.equal(replies.find(reply => reply.id === null).error.code, -32600)
  assert.deepEqual(replies.filter(reply => reply.id !== null).map(reply => reply.id).sort(), [1, 2])
  assert.deepEqual(received.sort(), [1, 2])
})

test('local MCP bridge cancels the exact HTTP exchange while all slots and a waiting request are occupied', async t => {
  const held = new Map(), received = [], closed = new Set()
  let input, fallback, independent, forced = false
  const replyIndependent = () => {
    if (independent && (closed.has(1) || forced)) {
      independent.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: 10, result: {} }))
      independent = undefined
    }
  }
  const finish = id => {
    const response = held.get(id)
    if (!response) return
    held.delete(id)
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id, result: {} }))
  }
  const server = createServer((incoming, response) => {
    let body = ''
    incoming.on('data', chunk => { body += chunk })
    incoming.on('end', () => {
      const request = JSON.parse(body)
      received.push(request.id ?? request.method)
      if (request.id === undefined) { response.writeHead(202).end(); return }
      if (request.id === 10) { independent = response; replyIndependent(); return }
      held.set(request.id, response)
      response.on('close', () => { if (held.delete(request.id)) closed.add(request.id); replyIndependent() })
      if (held.size === 8) {
        input.write(JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list', params: {} }) + '\n')
        for (const requestId of [9, 1]) input.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId } }) + '\n')
        input.end(JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'tools/list', params: {} }) + '\n')
        fallback = setTimeout(() => { forced = true; for (const id of [...held.keys()]) finish(id); replyIndependent() }, 1500)
      }
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { clearTimeout(fallback); server.closeAllConnections(); server.close() })
  const result = await runMcpBridge(stdin => {
    input = stdin
    for (let id = 1; id <= 8; id++) input.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/list', params: {} }) + '\n')
  }, `http://127.0.0.1:${server.address().port}`, reply => {
    if (reply.id === 10) { clearTimeout(fallback); for (const id of [...held.keys()]) finish(id) }
  })
  assert.equal(forced, false)
  assert.equal(closed.has(1), true)
  assert.equal(closed.size, 1)
  assert.equal(received.includes(9), false)
  assert.equal(received.includes('notifications/cancelled'), false)
  assert.equal(result.code, 0, result.stderr)
  const ids = result.stdout.trim().split('\n').map(line => JSON.parse(line).id).sort((a, b) => a - b)
  assert.deepEqual(ids, [2, 3, 4, 5, 6, 7, 8, 10])
})

test('local MCP bridge bounds waiting work and reports excess requests without admitting them', async t => {
  const held = [], received = []
  let busy = false, released = false, fallback, forced = false
  const finish = ([response, id]) => response.writeHead(200, { 'content-type': 'application/json' })
    .end(JSON.stringify({ jsonrpc: '2.0', id, result: {} }))
  const release = () => {
    if (busy && held.length === 8) { released = true; clearTimeout(fallback); while (held.length) finish(held.shift()) }
  }
  const server = createServer((incoming, response) => {
    let body = ''
    incoming.on('data', chunk => { body += chunk })
    incoming.on('end', () => {
      const request = JSON.parse(body)
      received.push(request.id)
      if (released) { finish([response, request.id]); return }
      held.push([response, request.id])
      if (received.length === 1) fallback = setTimeout(() => {
        forced = true; released = true; while (held.length) finish(held.shift())
      }, 1500)
      release()
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { clearTimeout(fallback); server.closeAllConnections(); server.close() })
  const requests = Array.from({ length: 41 }, (_, index) => ({ jsonrpc: '2.0', id: index + 1, method: 'tools/list', params: {} }))
  const result = await runMcpBridge(requests, `http://127.0.0.1:${server.address().port}`, reply => {
    if (reply.id === 41 && reply.error?.data?.code === 'BRIDGE_BUSY') { busy = true; release() }
  })
  assert.equal(busy, true)
  assert.equal(forced, false)
  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(received.sort((a, b) => a - b), requests.slice(0, 40).map(request => request.id))
  const replies = result.stdout.trim().split('\n').map(line => JSON.parse(line))
  assert.equal(replies.length, 41)
  assert.equal(replies.find(reply => reply.id === 41).error.data.recoverable, true)
  assert.equal(replies.filter(reply => reply.id !== 41).every(reply => reply.result), true)
})
