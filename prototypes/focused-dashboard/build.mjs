import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as icons from 'lucide-react'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const output = process.argv[2]
if (!output) throw new Error('Provide an output directory for this standalone design study.')
const iconNames = ['ArrowLeft', 'ArrowRight', 'ArrowUpRight', 'Check', 'CheckCheck', 'ChevronDown', 'ChevronLeft', 'ChevronRight', 'CircleHelp', 'Clock3', 'Copy', 'ExternalLink', 'FileText', 'Flag', 'Globe2', 'LayoutDashboard', 'Link2', 'ListFilter', 'LoaderCircle', 'Mail', 'MoreHorizontal', 'MousePointer2', 'PanelLeftClose', 'Plus', 'RefreshCw', 'Search', 'Settings2', 'ShieldCheck', 'SlidersHorizontal', 'Sparkles', 'X']
const glyphs = Object.fromEntries(iconNames.map(name => [name, renderToStaticMarkup(createElement(icons[name], { size: 18, 'aria-hidden': true, focusable: false }))]))
const encoded = async (path, mime) => `data:${mime};base64,${(await readFile(resolve(root, path))).toString('base64')}`
let html = await readFile(resolve(here, 'index.html'), 'utf8')
const substitutions = {
  STYLE: await readFile(resolve(here, 'styles.css'), 'utf8'),
  SCRIPT: await readFile(resolve(here, 'app.js'), 'utf8'),
  ICONS: JSON.stringify(glyphs),
  LOGO: await readFile(resolve(root, 'public/brand/logo-mark.svg'), 'utf8'),
  INTER: await encoded('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'font/woff2'),
  TIGHT: await encoded('node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2', 'font/woff2'),
  CART: await encoded('public/marketing/evidence/cart-empty.png', 'image/png'),
  PRICING: await encoded('public/marketing/evidence/pricing-unavailable.png', 'image/png'),
}
for (const [key, value] of Object.entries(substitutions)) html = html.replaceAll(`@@${key}@@`, () => value)
if (/@@[A-Z]+@@/.test(html)) throw new Error('An asset was not embedded.')
await mkdir(output, { recursive: true })
await writeFile(resolve(output, 'index.html'), html)
console.log(`Design study ready: ${resolve(output, 'index.html')}`)
