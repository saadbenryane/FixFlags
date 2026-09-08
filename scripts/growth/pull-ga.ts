#!/usr/bin/env -S npx tsx -r dotenv/config
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { runGaPull } from '@/lib/growth/ga-pull'
import { parseGrowthPullCliArgs } from '@/lib/growth/pull-options'
import { prisma } from '@/lib/db'

loadEnv({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' })

const metricsDirectory = join(process.cwd(), 'docs/growth/metrics')

async function save(filename: string, payload: unknown): Promise<void> {
  await mkdir(metricsDirectory, { recursive: true })
  await writeFile(join(metricsDirectory, filename), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function main(): Promise<void> {
  const options = parseGrowthPullCliArgs(process.argv.slice(2))
  const result = await runGaPull(options)
  if (!result) throw new Error('GSC_SERVICE_ACCOUNT_KEY is required for the GA export')
  await Promise.all([
    save('ga-summary.json', result.summary),
    save('ga-sources.json', result.sources),
    save('ga-pages.json', result.pages),
    save('ga-events.json', result.events),
  ])
  console.log(`[pull-ga] exported metrics to ${metricsDirectory}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[pull-ga] fatal:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
