#!/usr/bin/env -S npx tsx -r dotenv/config
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { runGscPull } from '@/lib/growth/gsc-pull'
import { prisma } from '@/lib/db'

loadEnv({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' })

const metricsDirectory = join(process.cwd(), 'docs/growth/metrics')

async function save(filename: string, payload: unknown): Promise<void> {
  await mkdir(metricsDirectory, { recursive: true })
  await writeFile(join(metricsDirectory, filename), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function main(): Promise<void> {
  const result = await runGscPull()
  if (!result) throw new Error('GSC_SERVICE_ACCOUNT_KEY is required for the GSC export')
  await Promise.all([
    save('gsc-queries.json', result.queries),
    save('gsc-pages.json', result.pages),
    save('gsc-summary.json', result.summary),
  ])
  console.log(`[pull-gsc] exported metrics to ${metricsDirectory}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[pull-gsc] fatal:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
