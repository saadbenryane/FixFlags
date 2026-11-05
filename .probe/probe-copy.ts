import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components']
const CUSTOMER_PROPS = new Set([
  'title','label','description','placeholder','aria-label','alt','heading','subheading','subtitle',
  'body','message','hint','note','caption','tooltip','text','helperText','errorText','actionLabel',
  'cta','buttonLabel','menuLabel','tabLabel','srLabel','emptyTitle','emptyBody','emptyText','ariaDescription',
])
function skip(rel: string) {
  if (rel.includes('__tests__') || /\.test\.(ts|tsx)$/.test(rel)) return true
  if (rel.includes('lib/marketing')) return true
  if (rel.startsWith('app/admin/') || rel.startsWith('components/admin/')) return true
  if (rel.startsWith('components/ui/')) return true
  return false
}
function walk(dir: string, out: string[] = []): string[] {
  const abs = join(ROOT, dir)
  if (!statSync(abs).isDirectory()) return out
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const child = join(abs, e.name)
    if (e.isDirectory()) walk(relative(ROOT, child), out)
    else if (e.name.endsWith('.tsx')) out.push(child)
  }
  return out
}
function looksLikeProse(v: string) {
  if (!v || !/[a-z]/.test(v)) return false
  if (!/\s/.test(v.trim())) return false
  if (/^(https?:|\/|#|mailto:)/i.test(v.trim())) return false
  if (/^[a-z0-9-]+(\s[a-z0-9-]+)*$/.test(v.trim())) return false  // all-lowercase identifiers
  if (/[\"'`{}]/.test(v)) return false
  return true
}
const hits: { file: string; kind: string; text: string }[] = []
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const rel = relative(ROOT, file)
    if (skip(rel)) continue
    const src = readFileSync(file, 'utf8')
    let m
    const textRe = />([^<>{}]*[a-zA-Z][^<>{}]*)</g
    while ((m = textRe.exec(src))) {
      const t = m[1].trim()
      if (looksLikeProse(t)) hits.push({ file: rel, kind: 'text', text: t })
    }
    const attrRe = /\b([a-zA-Z][a-zA-Z-]*)=(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g
    while ((m = attrRe.exec(src))) {
      const prop = m[1]
      if (!CUSTOMER_PROPS.has(prop)) continue
      const v = (m[2] ?? m[3] ?? m[4] ?? '').trim()
      if (looksLikeProse(v)) hits.push({ file: rel, kind: prop, text: v })
    }
  }
}
const byFile = new Map<string, number>()
for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1)
console.log('total hits:', hits.length, 'files:', byFile.size)
console.log([...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20))
