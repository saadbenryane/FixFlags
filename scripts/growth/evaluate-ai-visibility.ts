import { readFile, realpath, stat } from 'node:fs/promises'
import { resolve, relative, isAbsolute } from 'node:path'
import { execFileSync } from 'node:child_process'
import { evaluateAiVisibility } from '@/lib/growth/ai-visibility'
import { AI_VISIBILITY_PROMPTS } from '@/lib/growth/ai-visibility-prompts'

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--prompts') {
    console.log(JSON.stringify(AI_VISIBILITY_PROMPTS.map(([id, category, prompt]) => ({ id, category, prompt })), null, 2))
    return
  }
  if (!args.length) {
    console.log(JSON.stringify(evaluateAiVisibility({ publicBrandAnswersOnly: true, observations: [] }), null, 2))
    return
  }
  if (args.length !== 1 || args[0].startsWith('--')) throw new Error('Invalid arguments')
  const root = await realpath(process.cwd())
  const file = await realpath(resolve(args[0]))
  const path = relative(root, file)
  // Raw observations must stay in an ignored local file, including symlink targets.
  if (path.startsWith('..') || isAbsolute(path) || !path || (await stat(file)).size > 10_000_000) throw new Error('Invalid input file')
  execFileSync('git', ['check-ignore', '--quiet', '--', path], { cwd: root, stdio: 'ignore' })
  console.log(JSON.stringify(evaluateAiVisibility(JSON.parse(await readFile(file, 'utf8'))), null, 2))
}
main().catch(() => {
  console.error('AI visibility evaluation unavailable. Use --prompts, no arguments, or one ignored local JSON file containing valid recorded public brand answers. No raw input, file path or exception was printed.')
  process.exitCode = 1
})
