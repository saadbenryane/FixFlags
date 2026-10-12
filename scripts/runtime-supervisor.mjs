import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

export function createSupervisor({ env, shutdownMs, onFailure = () => {}, log = console.error }) {
  const children = new Set()
  let stopping = false, shutdownPromise
  function signal(record, name) {
    if (!record.child.pid) return
    try {
      if (process.platform === 'win32' || (name === 'SIGTERM' && record.role === 'worker')) record.child.kill(name)
      else process.kill(-record.child.pid, name)
    } catch (error) { if (error.code !== 'ESRCH') throw error }
  }
  function launch(args, { role, overrides = {}, transient = false } = {}) {
    if (stopping) throw new Error('Runtime is stopping')
    const child = spawn(process.execPath, args, {
      env: { ...env, ...overrides }, stdio: 'inherit', detached: process.platform !== 'win32',
    })
    const record = { child, role, closed: false }
    children.add(record)
    record.done = new Promise(resolve => {
      child.once('error', error => { record.error = error; log(`${role} failed to start`); onFailure(1) })
      child.once('close', (code, cause) => {
        signal(record, 'SIGKILL')
        record.closed = true
        if (!transient && !stopping) { log(`${role} exited (${cause || code}); stopping its companion`); onFailure(code || 1) }
        resolve({ code, cause, error: record.error })
      })
    })
    return record
  }
  function shutdown() {
    if (shutdownPromise) return shutdownPromise
    stopping = true
    shutdownPromise = (async () => {
      for (const record of children) if (!record.closed) signal(record, 'SIGTERM')
      const controller = new AbortController()
      const timedOut = await Promise.race([
        Promise.all([...children].map(record => record.done)).then(() => false),
        delay(shutdownMs, true, { signal: controller.signal }).catch(() => false),
      ])
      controller.abort()
      if (timedOut) log('Shutdown deadline exceeded. Interrupting only owned process groups; unfinished work remains interrupted.')
      // Wrappers may exit while their descendants remain in the owned group.
      for (const record of children) if (!record.closed) signal(record, 'SIGKILL')
      await Promise.all([...children].map(record => record.done))
      children.clear()
      return !timedOut
    })()
    return shutdownPromise
  }
  return { launch, shutdown, isStopping: () => stopping }
}
