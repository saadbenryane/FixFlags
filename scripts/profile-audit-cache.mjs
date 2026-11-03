import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const directory = path.resolve('.data/cost-optimization/cache-profile')
await mkdir(directory, { recursive: true })
await writeFile(path.join(directory, 'before.ts'), execFileSync('git', ['show', 'HEAD:lib/audit/cache.ts']))
const runner = `const { randomBytes } = require('node:crypto'); const { AuditCache } = require(process.argv[2]);
  const cache = new AuditCache(); global.gc(); const before = process.memoryUsage();
  for (let i=0;i<80;i++) cache.set('fixture-'+i, {raw:{trace:randomBytes(256000).toString('hex')}},3600000);
  global.gc(); const after=process.memoryUsage();
  console.log(JSON.stringify({heapGrowthBytes:after.heapUsed-before.heapUsed,rssGrowthBytes:after.rss-before.rss,diagnostics:cache.diagnostics??null}));cache.clear();`
await writeFile(path.join(directory, 'runner.cjs'), runner)
const result = {}
for (const [name, file] of [['before', path.join(directory, 'before.ts')], ['after', path.resolve('lib/audit/cache.ts')]]) {
  const out = path.join(directory, name + '.cjs')
  await build({ entryPoints: [file], outfile: out, bundle: true, platform: 'node', format: 'cjs' })
  result[name] = JSON.parse(execFileSync(process.execPath, ['--expose-gc', path.join(directory, 'runner.cjs'), out], { encoding: 'utf8' }))
}
await writeFile(path.join(directory, 'result.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
