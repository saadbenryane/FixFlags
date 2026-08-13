(function () {
  'use strict'

  var script = document.currentScript
  if (!script) return
  var productId = script.getAttribute('data-product')
  var key = script.getAttribute('data-key')
  if (!productId || !key) return

  var endpointOrigin = new URL(script.src, location.href).origin
  var endpoint = endpointOrigin + '/api/products/' + encodeURIComponent(productId) + '/signals'
  var releaseVersion = null
  var queue = []
  var flushTimer = null
  var sessionKey = 'ff_signal_session'
  var sessionTtl = 30 * 60 * 1000

  function randomId() {
    if (self.crypto && typeof self.crypto.randomUUID === 'function') return self.crypto.randomUUID()
    return Date.now().toString(36) + Math.random().toString(36).slice(2)
  }

  function sessionId() {
    var now = Date.now()
    try {
      var saved = JSON.parse(sessionStorage.getItem(sessionKey) || 'null')
      if (saved && typeof saved.id === 'string' && now - saved.at < sessionTtl) {
        sessionStorage.setItem(sessionKey, JSON.stringify({ id: saved.id, at: now }))
        return saved.id
      }
      var next = randomId()
      sessionStorage.setItem(sessionKey, JSON.stringify({ id: next, at: now }))
      return next
    } catch {
      return randomId()
    }
  }

  function safeName(name) {
    var value = String(name || '').trim().slice(0, 100)
    return /^[a-zA-Z0-9 _./:-]+$/.test(value) ? value : null
  }

  function enqueue(kind, name, value) {
    var normalized = safeName(name)
    if (!normalized) return
    queue.push({
      id: randomId(),
      kind: kind,
      name: normalized,
      route: location.pathname,
      session: sessionId(),
      release: releaseVersion || undefined,
      occurredAt: new Date().toISOString(),
      numericValue: typeof value === 'number' && isFinite(value) ? Math.max(0, value) : undefined,
    })
    if (queue.length >= 20) flush()
    else if (!flushTimer) flushTimer = setTimeout(flush, 1000)
  }

  function flush() {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = null
    if (!queue.length) return
    var events = queue.splice(0, 50)
    fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ key: key, events: events }),
    }).catch(function () {})
  }

  function navigation() {
    enqueue('NAVIGATION', 'route', undefined)
  }

  var pushState = history.pushState
  var replaceState = history.replaceState
  history.pushState = function () {
    var result = pushState.apply(history, arguments)
    navigation()
    return result
  }
  history.replaceState = function () {
    var result = replaceState.apply(history, arguments)
    navigation()
    return result
  }
  addEventListener('popstate', navigation)
  addEventListener('error', function (event) {
    var type = event.error && event.error.name ? event.error.name : 'runtime-error'
    enqueue('ERROR', type, undefined)
  })
  addEventListener('unhandledrejection', function (event) {
    var type = event.reason && event.reason.name ? event.reason.name : 'unhandled-rejection'
    enqueue('ERROR', type, undefined)
  })
  addEventListener('pagehide', flush)

  if (typeof PerformanceObserver === 'function') {
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries()
        var latest = entries[entries.length - 1]
        if (latest) enqueue('PERFORMANCE', 'LCP', latest.startTime)
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {}
    try {
      var cls = 0
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          if (!entry.hadRecentInput) cls += entry.value
        })
        enqueue('PERFORMANCE', 'CLS', cls)
      }).observe({ type: 'layout-shift', buffered: true })
    } catch {}
    try {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          enqueue('PERFORMANCE', 'INP', entry.duration)
        })
      }).observe({ type: 'event', buffered: true, durationThreshold: 40 })
    } catch {}
  }

  self.FixFlags = {
    goal: function (name) {
      enqueue('ACTION', name, undefined)
    },
    outcome: function (name, status) {
      if (status !== 'success' && status !== 'failure') return
      enqueue('OUTCOME', name + ':' + status, undefined)
    },
    release: function (version) {
      var normalized = safeName(version)
      if (!normalized) return
      releaseVersion = normalized
      enqueue('DEPLOYMENT', normalized, undefined)
    },
  }

  navigation()
})()
