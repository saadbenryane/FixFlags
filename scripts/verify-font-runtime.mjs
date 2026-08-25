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
const layoutMatch = pageHtml.match(/href="([^"]*\/app\/layout\.css\?v=[^"]+)"/)
if (!layoutMatch) {
  fail('could not find app layout stylesheet link in HTML')
}

const stylesheetUrl = new URL(layoutMatch[1], pageUrl).toString()
const stylesheetResponse = await fetch(stylesheetUrl)
if (!stylesheetResponse.ok) {
  fail(`failed to load layout stylesheet: ${stylesheetResponse.status} ${stylesheetResponse.statusText}`)
}

const stylesheetText = await stylesheetResponse.text()
const checks = {
  pageStatus: response.status,
  stylesheetStatus: stylesheetResponse.status,
  stylesheetUrl,
  bodyClassHasFontVariables: /font-variables/.test(pageHtml),
  hasRootFontVar: /:root\s*\{/.test(stylesheetText),
  hasFontVariablesRule: /\.font-variables\s*\{/.test(stylesheetText),
  hasFontSansVar: /--font-sans:\s*\"Inter Variable\"/.test(stylesheetText),
  hasFontDisplayVar: /--font-display:\s*\"Inter Tight Variable\"/.test(stylesheetText),
  hasFontMonoVar: /--font-mono:\s*\"JetBrains Mono Variable\"/.test(stylesheetText),
}

import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(pageUrl, { waitUntil: 'load' })
await page.waitForFunction(() => {
  return (
    document.body.classList.contains('font-variables') &&
    getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim().length > 0
  )
})
const runtime = await page.evaluate(() => {
  return {
    bodyClass: document.body.className,
    bodyFont: getComputedStyle(document.body).fontFamily,
    rootFont: getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim(),
    rootDisplayFont: getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim(),
    rootMonoFont: getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim(),
    h1Font: getComputedStyle(document.querySelector('h1') || document.body).fontFamily,
  }
})
await browser.close()

const runtimeChecks = {
  bodyFontInter: runtime.bodyFont.includes('Inter Variable'),
  headingFontInterTight: runtime.h1Font.includes('Inter Tight Variable'),
  headingFontInterSans: runtime.h1Font.includes('Inter Variable'),
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
  console.log(`stylesheet: ${checks.stylesheetUrl}`)
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
