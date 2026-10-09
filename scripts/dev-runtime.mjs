import dotenv from 'dotenv'
import { spawn } from 'node:child_process'
import net from 'node:net'
import IORedis from 'ioredis'

dotenv.config({ path: '.env.local', quiet: true })
const args = process.argv.slice(2)
const portIndex = args.indexOf('--port')
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use --port with a port between 1024 and 65535')
const origin = `http://localhost:${port}`
const env = { ...process.env, NODE_ENV: 'development', PORT: String(port), BETTER_AUTH_URL: origin, NEXT_PUBLIC_APP_URL: origin }
const children = new Set()
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
function launch(command, parameters, overrides = {}) {
  const child = spawn(command, parameters, { stdio: 'inherit', env: { ...env, ...overrides } })
  children.add(child)
  child.on('exit', (code) => { children.delete(child); if (!stopping) stop(code || 1) })
  child.on('error', (error) => { console.error(error.message); stop(1) })
  return child
}
async function runDoctor() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/doctor.mjs'], { stdio: 'inherit', env })
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('Fix the failed prerequisites before starting.')))
    child.on('error', reject)
  })
}
async function checkPort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, resolve) })
  await new Promise((resolve) => server.close(resolve))
}
const redis = new IORedis(env.REDIS_URL, { lazyConnect: true, connectTimeout: 2000, maxRetriesPerRequest: 0 })
try {
  await checkPort().catch(() => { throw new Error(`Port ${port} is occupied. Choose another port. No process was stopped.`) })
  await runDoctor()
  await redis.connect()
  let cursor = '0'
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'fixflags:worker:heartbeat:*', 'COUNT', 100)
    cursor = next
    if (keys.length) throw new Error('A worker already uses this Redis. Stop its owning session before starting another local runtime.')
  } while (cursor !== '0')
  launch(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(port)], { FIXFLAGS_PROCESS_ROLE: 'web' })
  launch(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'worker/index.ts'], { FIXFLAGS_PROCESS_ROLE: 'worker', AUDIT_WORKER_CONCURRENCY: '1' })
  const deadline = Date.now() + 120000
  let ready = false
  while (!stopping && Date.now() < deadline) {
    const response = await fetch(`${origin}/api/health/worker`, { signal: AbortSignal.timeout(3000) }).catch(() => null)
    const health = response?.ok ? await response.json() : null
    if (health?.worker?.alive && health.worker.browserOk && health.worker.workerCount === 1) {
      ready = true
      console.log(`FixFlags web and browser worker ready: ${origin}`)
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (!ready && !stopping) throw new Error('The web and browser worker did not become ready. See the startup errors above.')
} catch (error) {
  console.error(error.message)
  stop(1)
} finally {
  redis.disconnect()
}
