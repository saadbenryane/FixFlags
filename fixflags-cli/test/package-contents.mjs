import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const raw = execFileSync(npmExecutable, ['pack', '--dry-run', '--json'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
})
const pack = JSON.parse(raw)[0]
const files = pack.files.map((entry) => entry.path)

for (const required of ['bin/fixflags.js', 'dist/index.js', 'dist/workflows.js', 'dist/auth.js', 'dist/credentials.js', 'dist/init.js', 'dist/mcp-bridge.js', 'README.md', 'LICENSE', 'package.json']) {
  assert(files.includes(required), `Package is missing ${required}`)
}
assert(!files.some((file) => file.includes('node_modules/')), 'Package contains node_modules')
assert(!files.some((file) => file.startsWith('src/')), 'Package exposes TypeScript source')
console.log(`PASS package contents (${files.length} files)`)
