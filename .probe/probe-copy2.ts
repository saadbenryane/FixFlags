import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
const ROOT = process.cwd()
function skip(rel: string) {
  if (rel.includes('__tests__') || /\.test\.(ts|tsx)$/.test(rel)) return true
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
const byDir = new Map<string, number>()
for (const dir of ['app', 'components']) {
  for (const file of walk(dir)) {
    const rel = relative(ROOT, file)
    if (skip(rel)) continue
    const src = readFileSync(file, 'utf8')
    const dirKey = rel.split('/').slice(0, 2).join('/')
    const n = (src.match(/>[^<>{}]*[a-zA-Z][^<>{}]*</g) ?? []).length
    byDir.set(dirKey, (byDir.get(dirKey) ?? 0) + n)
  }
}
console.log([...byDir.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30))
