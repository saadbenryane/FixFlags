import { fontStylesheetUrls, stylesheetHasSelector } from './font-runtime-contract.mjs'
const args = process.argv.slice(2)
const useJson = args.includes('--json')
const optional = args.includes('--optional')
const urlArg = args.find((arg) => !arg.startsWith('--'))
const targetUrl = urlArg || process.env.FONT_RUNTIME_URL || 'http://127.0.0.1:3000'
const pageUrl = ensureTrailingSlash(targetUrl)

let response
try {
  response = await fetch(pageUrl)
} catch (error) {
  if (optional) {
    skip('server unavailable')
    process.exit(0)
  }
  throw error
}
if (!response.ok) {
  if (optional) {
    skip(`page request failed with ${response.status} ${response.statusText}`)
    process.exit(0)
  }
  fail(`failed to load page: ${response.status} ${response.statusText}`)
}

const pageHtml = await response.text()
// A different Next app can expose the same /app/layout.css URL on port 3000.
// Identify FixFlags before inspecting its font contract; a missing font class
// on a real FixFlags page must still fail instead of being treated as a skip.
const isFixFlagsPage = /<meta\b(?=[^>]*\bproperty=["']og:site_name["'])(?=[^>]*\bcontent=["']FixFlags["'])[^>]*>/i.test(pageHtml)
if (optional && !isFixFlagsPage) {
  skip('port is serving a different application')
  process.exit(0)
}
const stylesheetUrls = fontStylesheetUrls(pageHtml, pageUrl)
if (!stylesheetUrls.length) fail('could not find Next stylesheet links in HTML')
const stylesheetTexts = await Promise.all(stylesheetUrls.map(async url => {
  const stylesheet = await fetch(url)
  if (!stylesheet.ok) fail(`failed to load stylesheet: ${stylesheet.status} ${stylesheet.statusText}`)
  return stylesheet.text()
}))
const stylesheetText = stylesheetTexts.join('\n')
const checks = {
  pageStatus: response.status,
  stylesheetStatus: 200,
  stylesheetUrls,
  bodyClassHasFontVariables: /font-variables/.test(pageHtml),
  hasRootFontVar: stylesheetHasSelector(stylesheetText, ':root'),
  hasFontVariablesRule: stylesheetHasSelector(stylesheetText, '.font-variables'),
  hasFontSansVar: /--font-sans:\s*\"Inter Variable\"/.test(stylesheetText),
  hasFontDisplayVar: /--font-display:\s*\"Inter Tight Variable\"/.test(stylesheetText),
  hasFontMonoVar: /--font-mono:\s*\"JetBrains Mono Variable\"/.test(stylesheetText),
}

import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
let runtime
try {
const page = await browser.newPage()
page.setDefaultTimeout(15_000)
await page.goto(pageUrl, { waitUntil: 'load' })
await page.waitForSelector('h1', { state: 'visible' })
await page.evaluate(() => document.fonts.ready)
await page.waitForFunction(() => {
  return (
    document.body.classList.contains('font-variables') &&
    getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim().length > 0
  )
})
runtime = await page.evaluate(() => {
  return {
    bodyClass: document.body.className,
    bodyFont: getComputedStyle(document.body).fontFamily,
    rootFont: getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim(),
    rootDisplayFont: getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim(),
    rootMonoFont: getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim(),
    h1Font: getComputedStyle(document.querySelector('h1')).fontFamily,
  }
})
} finally { await browser.close() }

const runtimeChecks = {
  bodyFontInter: runtime.bodyFont.includes('Inter Variable'),
  headingFontInterTight: runtime.h1Font.includes('Inter Tight Variable'),
  rootFontVarExact: runtime.rootFont.includes('Inter Variable'),
}

const failures = [
  ...Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `check failed: ${name}`),
  ...Object.entries(runtimeChecks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `runtime failed: ${name}`),
]

const result = {
  url: pageUrl,
  checks,
  runtime,
  runtimeChecks,
}

if (failures.length) {
  fail(`font runtime contract failed\n${failures.map((item) => `- ${item}`).join('\n')}`, result)
}

if (useJson) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log('PASS: font runtime contract')
  console.log(`page status: ${checks.pageStatus}`)
  console.log(`stylesheet status: ${checks.stylesheetStatus}`)
  console.log(`stylesheet: ${checks.stylesheetUrls.join(', ')}`)
  console.log(`body class: ${runtime.bodyClass}`)
  console.log(`body font: ${runtime.bodyFont}`)
  console.log(`h1 font: ${runtime.h1Font}`)
}

function fail(message, detail = null) {
  const payload = detail ? `\n${JSON.stringify(detail, null, 2)}` : ''
  throw new Error(`${message}${payload}`)
}

function skip(reason) {
  if (useJson) {
    console.log(JSON.stringify({ skipped: true, url: pageUrl, reason }, null, 2))
    return
  }
  console.log(`SKIP: font runtime contract (${reason})`)
}

function ensureTrailingSlash(value) {
  if (!value) {
    return 'http://127.0.0.1:3000/'
  }
  if (/^\//.test(value)) {
    return `http://127.0.0.1:3000${value}`
  }
  return value.endsWith('/') ? value : `${value}/`
}
