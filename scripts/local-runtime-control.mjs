import net from 'node:net'
import { mkdir, readFile, writeFile, unlink, chmod } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { hostname } from 'node:os'

export const runtimeStatePath = (cwd = process.cwd()) => join(realpathSync(cwd), '.data', 'local-runtime.json')

export async function readRuntimeState(cwd = process.cwd()) {
  try {
    const state = JSON.parse(await readFile(runtimeStatePath(cwd), 'utf8'))
    if (state.checkout !== realpathSync(cwd) || state.hostname !== hostname() || typeof state.token !== 'string' ||
      typeof state.runtimeId !== 'string' || typeof state.socket !== 'string' || !state.socket.startsWith('/tmp/fixflags-dev-')) {
      throw new Error('Local runtime ownership does not match this checkout and host')
    }
    return state
  } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

export function requestRuntimeControl(state, command, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(state.socket)
    let buffer = ''
    const fail = error => { socket.destroy(); reject(error) }
    socket.setTimeout(timeoutMs, () => fail(new Error('Local runtime control timed out; no process was signalled')))
    socket.on('error', fail)
    socket.on('connect', () => socket.write(JSON.stringify({ command, token: state.token, runtimeId: state.runtimeId, checkout: state.checkout }) + '\n'))
    socket.on('data', chunk => {
      buffer += chunk
      if (buffer.length > 4096) return fail(new Error('Invalid local control response'))
      if (!buffer.includes('\n')) return
      try {
        const response = JSON.parse(buffer.split('\n')[0])
        if (!response.ok || response.runtimeId !== state.runtimeId) return fail(new Error('Local runtime ownership could not be verified; no process was signalled'))
        socket.destroy()
        resolve(response)
      } catch (error) { fail(error) }
    })
    socket.on('end', () => { if (!buffer.includes('\n')) fail(new Error('Local runtime closed without an ownership acknowledgement')) })
  })
}

export async function createRuntimeControl({ cwd = process.cwd(), runtimeId = randomUUID(), status, stop }) {
  const checkout = realpathSync(cwd), statePath = runtimeStatePath(checkout)
  const previous = await readRuntimeState(checkout)
  if (previous) {
    try { await requestRuntimeControl(previous, 'status') }
    catch (error) {
      if (!['ENOENT', 'ECONNREFUSED'].includes(error.code)) throw error
      // Stale metadata grants no authority to terminate its recorded PID.
      if ((await readRuntimeState(checkout))?.token !== previous.token) throw new Error('Runtime ownership changed. Retry status.')
      await unlink(statePath)
    }
    if (await readRuntimeState(checkout)) throw new Error('This checkout already has a managed runtime. Run npm run dev:stop first.')
  }
  const token = randomUUID()
  const hash = createHash('sha256').update(checkout).digest('hex').slice(0, 12)
  const socketPath = `/tmp/fixflags-dev-${hash}-${runtimeId.slice(0, 8)}.sock`
  const state = { checkout, hostname: hostname(), runtimeId, token, socket: socketPath, pid: process.pid, startedAt: Date.now() }
  await mkdir(join(checkout, '.data'), { recursive: true })
  const connections = new Set()
  const server = net.createServer(socket => {
    connections.add(socket)
    socket.on('close', () => connections.delete(socket))
    socket.on('error', () => {})
    socket.setTimeout(3000, () => socket.destroy())
    let buffer = '', handled = false
    socket.on('data', chunk => {
      buffer += chunk
      if (buffer.length > 4096) return socket.destroy()
      if (handled || !buffer.includes('\n')) return
      handled = true
      try {
        const request = JSON.parse(buffer.split('\n')[0])
        const supplied = Buffer.from(typeof request.token === 'string' ? request.token : ''), expected = Buffer.from(token)
        const valid = supplied.length === expected.length && timingSafeEqual(supplied, expected) &&
          request.checkout === checkout && request.runtimeId === runtimeId && ['status', 'stop'].includes(request.command)
        if (!valid) return socket.end(JSON.stringify({ ok: false }) + '\n')
        const snapshot = status()
        socket.end(JSON.stringify({ ok: true, runtimeId, ...snapshot, stopping: request.command === 'stop' || snapshot.stopping }) + '\n')
        if (request.command === 'stop') void stop()
      } catch { socket.end(JSON.stringify({ ok: false }) + '\n') }
    })
  })
  const close = async () => {
    for (const socket of connections) socket.destroy()
    if (server.listening) await new Promise(resolve => server.close(resolve))
    await unlink(socketPath).catch(error => { if (error.code !== 'ENOENT') throw error })
    if ((await readRuntimeState(checkout))?.token === token) await unlink(statePath)
  }
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve) })
    await chmod(socketPath, 0o600)
    // Publish only after the control socket is listening. Another starter must
    // never mistake a not-yet-bound supervisor for stale ownership.
    await writeFile(statePath, JSON.stringify(state), { flag: 'wx', mode: 0o600 })
    return { state, close }
  } catch (error) { await close(); throw error }
}
