/** Only the supervised child's fresh lifecycle messages authorize readiness. */
export function createWorkerHealth(now = Date.now, freshnessMs = 45_000) {
  let state = 'starting', seenAt = null
  return {
    receive(message) {
      if (state === 'stopping' || !message || message.type !== 'fixflags-worker-state' ||
          !['starting', 'ready', 'stopping'].includes(message.state)) return
      state = message.state; seenAt = now()
    },
    stop() { state = 'stopping' },
    snapshot() {
      const fresh = seenAt !== null && now() >= seenAt && now() - seenAt <= freshnessMs
      const ready = state === 'ready' && fresh
      return { status: ready ? 'ok' : 'unavailable', state: state === 'ready' && !fresh ? 'unresponsive' : state, ready }
    },
  }
}
