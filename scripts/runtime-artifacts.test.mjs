import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, copyFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, posix } from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { runtimeEntry } from './runtime-artifacts.mjs'
import { createWorkerHealth } from '../lib/runtime/worker-health.mjs'
import { superviseWorkerBrowser } from '../lib/runtime/worker-browser.mjs'
import { EventEmitter } from 'node:events'

const browserOptions = { headless: true, args: ['--no-sandbox'], proxy: { server: 'http://127.0.0.1:1234', bypass: '<-loopback>' } }
function browserChild() {
  const child = new EventEmitter(), replies = []
  child.connected = true
  child.send = message => replies.push(message)
  return { child, replies }
}
test('browser ownership waits for an in-flight launch and physical cleanup after worker loss', async () => {
  const { child, replies } = browserChild()
  let launched, released, killed = false, stopped = false
  const owner = superviseWorkerBrowser(child, options => {
    assert.equal(options.host, '127.0.0.1')
    assert.equal(options.handleSIGTERM, false)
    return new Promise(resolve => { launched = resolve })
  })
  child.emit('message', { type: 'fixflags:browser', id: 'launch', action: 'launch', options: browserOptions })
  await delay(0)
  child.connected = false
  const cleanup = owner.stop().then(() => { stopped = true })
  launched({ wsEndpoint: () => 'ws://127.0.0.1:1/private', kill: () => {
    killed = true; return new Promise(resolve => { released = resolve })
  } })
  await delay(0)
  assert.equal(killed, true)
  assert.equal(stopped, false)
  assert.deepEqual(replies, [])
  released(); await cleanup
  await owner.stop()
})
test('the worker can close and replace its browser, with no overlapping physical owners', async () => {
  const { child, replies } = browserChild()
  let launches = 0, kills = 0
  const owner = superviseWorkerBrowser(child, async () => {
    launches++
    return { wsEndpoint: () => 'ws://127.0.0.1:1/private', kill: async () => { kills++ } }
  })
  const send = (id, action) => child.emit('message', { type: 'fixflags:browser', id, action, options: browserOptions })
  send('first', 'launch'); send('overlap', 'launch'); send('close', 'close'); send('replacement', 'launch')
  await delay(0)
  assert.equal(launches, 2)
  assert.equal(kills, 1)
  assert.ok(replies.find(reply => reply.id === 'overlap').error)
  assert.equal(replies.find(reply => reply.id === 'replacement').endpoint, 'ws://127.0.0.1:1/private')
  await owner.stop(); assert.equal(kills, 2)
})
test('browser launch refuses a non-loopback proxy without opening a process or exposing provider detail', async () => {
  const { child, replies } = browserChild()
  const owner = superviseWorkerBrowser(child, () => { throw new Error('Unexpected launch') })
  child.emit('message', { type: 'fixflags:browser', id: 'refused', action: 'launch',
    options: { ...browserOptions, proxy: { server: 'http://external.test:1234', bypass: '<-loopback>' } } })
  await delay(0)
  assert.deepEqual(replies, [{ type: 'fixflags:browser-result', id: 'refused', error: 'The managed browser could not complete this operation' }])
  await owner.stop()
})

test('worker health requires fresh child readiness and cannot recover after shutdown', () => {
  let now = 1000
  const health = createWorkerHealth(() => now)
  assert.deepEqual(health.snapshot(), { status: 'starting', ready: false })
  health.receive({ type: 'unrelated', state: 'ready' })
  assert.equal(health.snapshot().ready, false)
  health.receive({ type: 'fixflags:worker-state', state: 'ready' })
  assert.deepEqual(health.snapshot(), { status: 'ready', ready: true })
  now += 45_001
  assert.deepEqual(health.snapshot(), { status: 'unavailable', ready: false })
  health.receive({ type: 'fixflags:worker-state', state: 'ready' })
  assert.equal(health.snapshot().ready, true)
  health.stop()
  health.receive({ type: 'fixflags:worker-state', state: 'ready' })
  assert.deepEqual(health.snapshot(), { status: 'stopping', ready: false })
})

test('the packaged runtime includes every local module imported by its bootstrap', () => {
  const source = readFileSync(new URL('runtime-start.mjs', import.meta.url), 'utf8')
  const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8')
  for (const match of source.matchAll(/['"](\.\.?\/[^'"]+\.mjs)['"]/g)) {
    const dependency = posix.normalize(posix.join('scripts', match[1]))
    assert.ok(dockerfile.includes(`/app/${dependency} ./${dependency}`), `Packaged runtime is missing ${dependency}`)
  }
})

function isolatedStartup(cwd) {
  mkdirSync(join(cwd,'scripts'),{recursive:true})
  mkdirSync(join(cwd,'lib/runtime'),{recursive:true})
  mkdirSync(join(cwd,'node_modules/@next'),{recursive:true})
  for (const name of ['runtime-start.mjs','runtime-artifacts.mjs']) copyFileSync(new URL(name,import.meta.url),join(cwd,'scripts',name))
  copyFileSync(new URL('../lib/runtime/environment.mjs',import.meta.url),join(cwd,'lib/runtime/environment.mjs'))
  copyFileSync(new URL('../lib/runtime/worker-health.mjs',import.meta.url),join(cwd,'lib/runtime/worker-health.mjs'))
  copyFileSync(new URL('../lib/runtime/worker-browser.mjs',import.meta.url),join(cwd,'lib/runtime/worker-browser.mjs'))
  copyFileSync(new URL('../lib/runtime/migration-coordination.mjs',import.meta.url),join(cwd,'lib/runtime/migration-coordination.mjs'))
  mkdirSync(join(cwd,'node_modules/pg'),{recursive:true})
  writeFileSync(join(cwd,'node_modules/pg/package.json'),JSON.stringify({type:'module',exports:'./index.js'}))
  writeFileSync(join(cwd,'node_modules/pg/index.js'),`import { EventEmitter } from 'node:events';
    export class Client extends EventEmitter {
      async connect() {} async query() { return { rows: [{ acquired: true }] } }
      async end() { this.emit('end') }
    }`)
  symlinkSync(new URL('../node_modules/@next/env',import.meta.url).pathname,join(cwd,'node_modules/@next/env'),'dir')
  return join(cwd,'scripts/runtime-start.mjs')
}

test('missing build fails before Prisma migration can execute', () => {
  const cwd=mkdtempSync(join(tmpdir(),'ff-artifact-')), marker=join(cwd,'migrated')
  try {
    mkdirSync(join(cwd,'node_modules/prisma/build'),{recursive:true})
    writeFileSync(join(cwd,'node_modules/prisma/build/index.js'),`require('fs').writeFileSync(${JSON.stringify(marker)},'ran')`)
    const script=isolatedStartup(cwd)
    assert.throws(() => execFileSync(process.execPath,[script],{cwd,stdio:'pipe'}), error => /npm run build/.test(error.stderr.toString()))
    assert.equal(existsSync(marker),false)
    assert.throws(() => runtimeEntry('worker',cwd,{}), /worker:build/)
    mkdirSync(join(cwd,'dist/worker'),{recursive:true})
    writeFileSync(join(cwd,'dist/worker/index.js'),'worker')
    assert.throws(() => runtimeEntry('worker',cwd,{}), /parser runtime/)
  } finally { rmSync(cwd,{recursive:true,force:true}) }
})
test('checks standalone assets and honors isolated build directories', () => {
  const cwd=mkdtempSync(join(tmpdir(),'ff-artifact-'))
  try {
    mkdirSync(join(cwd,'.next-local/standalone'),{recursive:true})
    writeFileSync(join(cwd,'.next-local/standalone/server.js'),'server')
    assert.throws(() => runtimeEntry('web',cwd,{NEXT_DIST_DIR:'.next-local'}),/assets/)
    mkdirSync(join(cwd,'.next-local/standalone/.next-local/static'),{recursive:true})
    mkdirSync(join(cwd,'.next-local/standalone/public'))
    assert.equal(runtimeEntry('web',cwd,{NEXT_DIST_DIR:'.next-local'}),'.next-local/standalone/server.js')
  } finally { rmSync(cwd,{recursive:true,force:true}) }
})


test('a failed migration prevents a valid production server from booting', () => {
  const cwd=mkdtempSync(join(tmpdir(),'ff-migration-')), marker=join(cwd,'migration'), boot=join(cwd,'boot')
  try {
    const script=isolatedStartup(cwd)
    mkdirSync(join(cwd,'node_modules/prisma/build'),{recursive:true})
    writeFileSync(join(cwd,'node_modules/prisma/build/index.js'),`require('fs').writeFileSync(${JSON.stringify(marker)},'attempted');process.exit(7)`)
    mkdirSync(join(cwd,'.next/standalone/.next/static'),{recursive:true})
    mkdirSync(join(cwd,'.next/standalone/public'))
    writeFileSync(join(cwd,'.next/standalone/server.js'),`require('fs').writeFileSync(${JSON.stringify(boot)},'booted')`)
    assert.throws(() => execFileSync(process.execPath,[script],{cwd,stdio:'pipe',env:{...process.env,DATABASE_URL:'postgresql://fixture:fixture@localhost/fixture'}}), error => error.status === 7)
    assert.equal(existsSync(marker),true)
    assert.equal(existsSync(boot),false)
  } finally { rmSync(cwd,{recursive:true,force:true}) }
})

test('the actual bootstrap health server waits for its child and refuses readiness during drain', { timeout: 15_000 }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ff-worker-health-')), ready = join(cwd, 'ready')
  let child
  try {
    const script = isolatedStartup(cwd)
    mkdirSync(join(cwd, 'node_modules/prisma/build'), { recursive: true })
    writeFileSync(join(cwd, 'node_modules/prisma/build/index.js'), 'process.exit(0)')
    mkdirSync(join(cwd, 'dist/worker'), { recursive: true })
    writeFileSync(join(cwd, 'dist/worker/check-parser.js'), '')
    writeFileSync(join(cwd, 'dist/worker/index.js'), `
      const fs = require('node:fs');
      const timer = setInterval(() => {
        if (fs.existsSync(${JSON.stringify(ready)})) process.send({type:'fixflags:worker-state',state:'ready'});
      }, 20);
      process.on('SIGTERM', () => { clearInterval(timer); setTimeout(() => process.exit(0), 500); });
    `)
    child = spawn(process.execPath, [script, 'worker'], { cwd, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, WORKER_HEALTH_PORT: '0', DATABASE_URL: 'postgresql://fixture:fixture@localhost/fixture' } })
    let output = ''
    child.stdout.on('data', chunk => { output += chunk.toString() })
    child.stderr.on('data', chunk => { output += chunk.toString() })
    async function until(check) {
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        const value = await check()
        if (value) return value
        if (child.exitCode !== null) throw new Error(output)
        await delay(20)
      }
      throw new Error('Worker health condition timed out: ' + output)
    }
    const port = await until(() => output.match(/health server listening on port (\d+)/)?.[1])
    const url = `http://127.0.0.1:${port}/`
    const starting = await fetch(url)
    assert.equal(starting.status, 503)
    assert.deepEqual(await starting.json(), { status: 'starting', ready: false })
    writeFileSync(ready, 'ready')
    await until(async () => (await fetch(url)).status === 200)
    child.kill('SIGTERM')
    await until(async () => {
      const response = await fetch(url)
      return response.status === 503 && (await response.json()).status === 'stopping'
    })
    await new Promise(resolve => child.once('exit', resolve))
  } finally {
    if (child?.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    rmSync(cwd, { recursive: true, force: true })
  }
})
