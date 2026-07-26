import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import {
  mkdtempSync,
  readFileSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../bin/fixflags.js', import.meta.url))

function runCli(args, options) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: options.cwd,
      env: {
        ...process.env,
        FIXFLAGS_API_KEY: '',
        FIXFLAGS_API_URL: options.apiUrl,
        FIXFLAGS_CONFIG_DIR: options.configDir,
        FIXFLAGS_NO_OPEN: '1',
        NO_COLOR: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => resolveRun({ code, stdout, stderr }))
    child.stdin.end(options.stdin || '')
  })
}

function startServer() {
  let revoked = false
  let tokenPolls = 0
  const skill = `---
name: fixflags
description: Check and verify a deployed product with FixFlags.
---

# FixFlags

Check, fix, deploy, and Re-check the original report.
`
  const server = createServer((request, response) => {
    if (request.url === '/.well-known/skills/fixflags/SKILL.md') {
      response.writeHead(200, { 'content-type': 'text/markdown' })
      response.end(skill)
      return
    }
    if (request.url === '/api/cli/auth/device' && request.method === 'POST') {
      response.writeHead(201, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        deviceCode: 'device-code',
        userCode: 'ABCD-EFGH',
        verificationUriComplete: 'https://example.test/cli/authorize?user_code=ABCD-EFGH',
        expiresIn: 30,
        interval: 0.01,
      }))
      return
    }
    if (request.url === '/api/cli/auth/token' && request.method === 'POST') {
      tokenPolls += 1
      response.writeHead(tokenPolls === 1 ? 428 : 200, {
        'content-type': 'application/json',
      })
      response.end(JSON.stringify(
        tokenPolls === 1
          ? { code: 'AUTHORIZATION_PENDING' }
          : { accessToken: 'ff_live_browser_test', tokenType: 'Bearer' }
      ))
      return
    }
    if (request.url === '/api/cli/auth/session') {
      if (request.method === 'DELETE') revoked = true
      const authorization = request.headers.authorization
      if (!authorization?.startsWith('Bearer ff_live_')) {
        response.writeHead(401, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ message: 'Invalid token' }))
        return
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(
        request.method === 'DELETE'
          ? { ok: true }
          : {
              user: { id: 'user-1', email: 'customer@example.com', plan: 'BUILDER' },
              credential: { id: 'key-1', client: 'cli' },
            }
      ))
      return
    }
    response.writeHead(404)
    response.end()
  })
  return { server, wasRevoked: () => revoked }
}

test('manual token login never places the secret in argv and supports whoami and logout', async (t) => {
  const { server, wasRevoked } = startServer()
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  t.after(() => server.close())
  const address = server.address()
  const apiUrl = `http://127.0.0.1:${address.port}`
  const root = mkdtempSync(join(tmpdir(), 'fixflags-auth-'))
  const configDir = join(root, 'config')
  const options = { cwd: root, configDir, apiUrl }

  const login = await runCli(
    ['login', '--with-token', '--insecure-storage'],
    { ...options, stdin: 'ff_live_manual_test\n' }
  )
  assert.equal(login.code, 0, login.stderr)
  assert.match(login.stdout, /customer@example\.com/)
  assert.doesNotMatch(login.stdout + login.stderr, /ff_live_manual_test/)

  const configPath = join(configDir, 'config.json')
  if (process.platform !== 'win32') {
    assert.equal(statSync(configPath).mode & 0o777, 0o600)
  }

  const whoami = await runCli(['whoami'], options)
  assert.equal(whoami.code, 0, whoami.stderr)
  assert.match(whoami.stdout, /customer@example\.com/)

  const logout = await runCli(['logout'], options)
  assert.equal(logout.code, 0, logout.stderr)
  assert.equal(wasRevoked(), true)
})

test('browser login follows one-time device authorization', async (t) => {
  const { server } = startServer()
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  t.after(() => server.close())
  const address = server.address()
  const root = mkdtempSync(join(tmpdir(), 'fixflags-browser-auth-'))
  const result = await runCli(
    ['login', '--insecure-storage'],
    {
      cwd: root,
      configDir: join(root, 'config'),
      apiUrl: `http://127.0.0.1:${address.port}`,
    }
  )
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /ABCD-EFGH/)
  assert.match(result.stdout, /customer@example\.com/)
  assert.doesNotMatch(result.stdout + result.stderr, /ff_live_browser_test/)
})

test('init merges MCP configuration, installs the canonical rule, and is idempotent', async (t) => {
  const { server } = startServer()
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  t.after(() => server.close())
  const address = server.address()
  const root = mkdtempSync(join(tmpdir(), 'fixflags-init-'))
  const apiUrl = `http://127.0.0.1:${address.port}`
  const options = { cwd: root, configDir: join(root, 'config'), apiUrl }

  const preview = await runCli(
    ['init', 'https://product.example', '--editor', 'cursor', '--dry-run', '--yes'],
    options
  )
  assert.equal(preview.code, 0, preview.stderr)
  assert.match(preview.stdout, /init preview/)

  const first = await runCli(
    ['init', 'https://product.example', '--editor', 'cursor', '--yes'],
    options
  )
  assert.equal(first.code, 0, first.stderr)
  const mcpPath = join(root, '.cursor', 'mcp.json')
  const firstConfig = readFileSync(mcpPath, 'utf8')
  assert.match(firstConfig, /"command": "fixflags"/)
  assert.match(firstConfig, /"mcp"/)
  assert.doesNotMatch(firstConfig, /ff_live_/)
  assert.match(
    readFileSync(join(root, '.cursor', 'rules', 'fixflags.mdc'), 'utf8'),
    /Re-check the original report/
  )

  const second = await runCli(
    ['init', 'https://product.example', '--editor', 'cursor', '--yes'],
    options
  )
  assert.equal(second.code, 0, second.stderr)
  assert.equal(readFileSync(mcpPath, 'utf8'), firstConfig)
})
