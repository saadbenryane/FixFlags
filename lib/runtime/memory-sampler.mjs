import { readFile } from 'node:fs/promises'

async function containerBytes() {
  for (const path of ['/sys/fs/cgroup/memory.current', '/sys/fs/cgroup/memory/memory.usage_in_bytes']) {
    try { const value = Number((await readFile(path, 'utf8')).trim()); if (Number.isFinite(value) && value >= 0) return value }
    catch { /* Local development may have no container accounting. */ }
  }
  return null
}
const count = value => Number.isFinite(value) && value >= 0 ? value : null

/** Fixed numeric fields only. A slow sample never overlaps the next sample. */
export function startMemorySampler({ role, readCounts = async () => ({}), emit, intervalMs = 60_000,
  memoryUsage = () => process.memoryUsage(), readContainer = containerBytes }) {
  let stopped = false, running = false
  async function sample() {
    if (stopped || running) return
    running = true
    try {
      const memory = memoryUsage(), [container, activity] = await Promise.all([readContainer(), readCounts()])
      if (stopped) return
      emit({ role, rssBytes: count(memory.rss), heapUsedBytes: count(memory.heapUsed), heapTotalBytes: count(memory.heapTotal),
        externalBytes: count(memory.external), arrayBufferBytes: count(memory.arrayBuffers), containerBytes: count(container),
        activeTasks: count(activity.activeTasks), browserContexts: count(activity.browserContexts) })
    } catch { /* Diagnostics cannot interrupt customer work. */ }
    finally { running = false }
  }
  const timer = setInterval(() => { void sample() }, intervalMs)
  timer.unref?.()
  void sample()
  return { stop() { stopped = true; clearInterval(timer) } }
}
