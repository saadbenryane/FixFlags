/** Stop timers synchronously, then settle callbacks already admitted. */
export function createTimerScheduler(onError: (error: unknown) => void) {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const pending = new Set<Promise<unknown>>()
  const running = new Set<() => Promise<unknown>>()
  let stopped = false
  function schedule(run: () => Promise<unknown>, ms: number, repeat = false) {
    const tick = () => {
      if (stopped || running.has(run)) return
      running.add(run)
      const promise = Promise.resolve().then(() => stopped ? undefined : run()).catch(onError).finally(() => {
        running.delete(run)
        pending.delete(promise)
      })
      pending.add(promise)
    }
    const timer = repeat ? setInterval(tick, ms) : setTimeout(tick, ms)
    timer.unref?.()
    timers.add(timer)
  }
  return {
    schedule,
    isStopped: () => stopped,
    async stop() {
      stopped = true
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
      await Promise.allSettled([...pending])
    },
  }
}
