import { NextRequest } from 'next/server'

const RUM_SCRIPT = String.raw`
(function() {
  var z = "[BASE_URL]/api/rum/collect";
  var t = "[SITE_ID]";

  function ratingTime(thresholdGood, thresholdPoor, value) {
    return value <= thresholdGood ? "good" : value <= thresholdPoor ? "needs-improvement" : "poor";
  }

  function ratingCls(value) {
    return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
  }

  function send(metric, value, rating, delta) {
    if (!navigator.sendBeacon) return;
    var data = JSON.stringify({
      siteId: t,
      page: location.pathname,
      metric: metric,
      value: value,
      rating: rating,
      delta: delta,
      nav: performance.navigation ? performance.navigation.type : -1
    });
    navigator.sendBeacon(z, data);
  }

  function init() {
    try {
      // LCP
      new PerformanceObserver(function(list) {
        for (var i = 0, entries = list.getEntries(), entry; i < entries.length; i++) {
          entry = entries[i];
          send("LCP", entry.startTime, ratingTime(2500, 4000, entry.startTime), entry.startTime);
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });

      // CLS
      new PerformanceObserver(function(list) {
        var clsValue = 0;
        for (var i = 0, entries = list.getEntries(), entry; i < entries.length; i++) {
          entry = entries[i];
          if (!entry.hadRecentInput) clsValue += entry.value;
        }
        send("CLS", clsValue, ratingCls(clsValue), clsValue);
      }).observe({ type: "layout-shift", buffered: true });

      // INP
      new PerformanceObserver(function(list) {
        for (var i = 0, entries = list.getEntries(), entry; i < entries.length; i++) {
          entry = entries[i];
          var duration = entry.interactionId ? entry.duration : (entry.processingEnd - entry.processingStart);
          if (duration > 0) send("INP", duration, ratingTime(200, 500, duration), duration);
        }
      }).observe({ type: "event", durationThreshold: 16, buffered: true });

      // FCP
      try {
        new PerformanceObserver(function(list) {
          for (var i = 0, entries = list.getEntries(), entry; i < entries.length; i++) {
            entry = entries[i];
            send("FCP", entry.startTime, ratingTime(1800, 3000, entry.startTime), entry.startTime);
          }
        }).observe({ type: "paint", buffered: true });
      } catch(e) {}

      // TTFB
      var navEntry = performance.getEntriesByType("navigation")[0];
      if (navEntry) send("TTFB", navEntry.responseStart, ratingTime(800, 1800, navEntry.responseStart), navEntry.responseStart);
    } catch(e) {}
  }

  if ("requestIdleCallback" in window) {
    requestIdleCallback(init);
  } else {
    setTimeout(init, 200);
  }
})();
`

function minify(js: string): string {
  return js
    .replace(/\/\/.*$/gm, '')
    .replace(/^\s*[\r\n]/gm, '')
    .replace(/\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000'
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  return `${proto}://${host}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get('siteId') || 'unknown'
  const baseUrl = getBaseUrl(request)

  const script = minify(RUM_SCRIPT)
    .replace('[BASE_URL]', baseUrl)
    .replace(/\[SITE_ID\]/g, siteId)

  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
