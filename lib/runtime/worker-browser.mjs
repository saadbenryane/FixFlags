/** The bootstrap owns physical browsers, so a worker crash cannot orphan them.
 * Only its private child IPC can request a browser. The endpoint stays loopback. */
export function superviseWorkerBrowser(child, launch) {
  let browser, pending = Promise.resolve(), stopping = false, stopped
  const reply = (id, result) => {
    try { if (child.connected) child.send({ type: 'fixflags:browser-result', id, ...result }, () => {}) }
    catch { /* A disconnected owner cannot receive an operation result. */ }
  }
  const close = async () => {
    const owned = browser
    if (!owned) return
    // kill() waits for the physical process. A crashed owner has no remaining
    // contexts to drain; ordinary worker closure has already drained them.
    await owned.kill()
    if (browser === owned) browser = undefined
  }
  child.on('message', message => {
    if (!message || message.type !== 'fixflags:browser' || typeof message.id !== 'string' || message.id.length > 100) return
    pending = pending.then(async () => {
      if (stopping) return
      try {
        if (message.action === 'close') {
          await close(); reply(message.id, { closed: true }); return
        }
        if (message.action !== 'launch' || browser) throw new Error('Browser ownership is unavailable')
        const options = message.options
        const proxy = new URL(options?.proxy?.server)
        if (options?.headless !== true || !Array.isArray(options.args) || options.args.length > 20 ||
            !options.args.every(argument => typeof argument === 'string' && argument.length <= 200) ||
            options.executablePath !== undefined && typeof options.executablePath !== 'string' ||
            proxy.protocol !== 'http:' || proxy.hostname !== '127.0.0.1' || !proxy.port || proxy.username || proxy.password ||
            proxy.pathname !== '/' || proxy.search || proxy.hash || options.proxy.bypass !== '<-loopback>')
          throw new Error('Invalid managed browser configuration')
        browser = await launch({ args: options.args, executablePath: options.executablePath,
          headless: true, proxy: { server: proxy.href, bypass: '<-loopback>' }, host: '127.0.0.1', timeout: 30_000,
          handleSIGTERM: false, handleSIGINT: false, handleSIGHUP: false })
        if (stopping || !child.connected) { await close(); return }
        reply(message.id, { endpoint: browser.wsEndpoint() })
      } catch {
        reply(message.id, { error: 'The managed browser could not complete this operation' })
      }
    })
  })
  return {
    stop() { stopping = true; return stopped ??= pending.then(close) },
  }
}
