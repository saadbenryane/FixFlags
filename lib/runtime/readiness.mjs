export function localReadiness(health, expectedWorkerId) {
  if (!health) return { ready: false, detail: 'web worker diagnostics unavailable' }
  if (health.redis !== 'ok') return { ready: false, detail: 'web cannot reach Redis' }
  if (!health.worker?.alive) return { ready: false, detail: 'worker heartbeat missing or expired' }
  if (health.worker.workerCount !== 1) return { ready: false, detail: `expected one worker, observed ${health.worker.workerCount}` }
  const worker = health.worker.workers?.[0]
  if (expectedWorkerId && worker?.workerId !== expectedWorkerId) return { ready: false, detail: 'heartbeat belongs to another worker' }
  if (!health.worker.browserOk) return { ready: false, detail: 'worker browser unavailable' }
  if (!worker || !['idle', 'active'].includes(worker.queueState)) return { ready: false, detail: `worker queue is ${worker?.queueState ?? 'unknown'}` }
  return { ready: true, detail: 'single identified worker, initialized queues and browser ready' }
}
