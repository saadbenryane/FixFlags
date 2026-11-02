import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { previewSitePurge, applySitePurge, type PurgeManifest, type PurgeProgress } from '../lib/account/site-purge'
import { deleteAuditScreenshotAssets } from '../lib/storage/screenshots'

const { values } = parseArgs({ options: {
  preview: { type: 'boolean' }, apply: { type: 'boolean' }, manifest: { type: 'string' },
  email: { type: 'string' }, 'keep-host': { type: 'string' }, 'remove-host': { type: 'string', multiple: true },
  'unlinked-host': { type: 'string', multiple: true },
} })
if (Boolean(values.preview) === Boolean(values.apply) || !values.manifest) throw new Error('Choose --preview or --apply and --manifest <file>')
if (!process.env.DATABASE_URL) throw new Error('Explicit DATABASE_URL is required; this operator command never loads local environment files')
const db = new PrismaClient()
async function persist(file: string, value: unknown) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  await writeFile(file + '.tmp', JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
  await rename(file + '.tmp', file)
}
async function main() {
try {
  if (values.preview) {
    if (!values.email || !values['keep-host'] || !values['remove-host']?.length) throw new Error('Preview requires --email, --keep-host and explicit --remove-host arguments')
    const manifest = await previewSitePurge(db, { email: values.email, keepHost: values['keep-host'], removeHosts: values['remove-host'], unlinkedHosts: values['unlinked-host'] ?? [] })
    await persist(values.manifest, manifest)
    console.log(JSON.stringify({ digest: manifest.digest, websites: manifest.projectIds.length, reports: manifest.auditIds.length, preservedReports: manifest.keptAuditIds.length }))
  } else {
    const manifest: PurgeManifest = JSON.parse(await readFile(values.manifest, 'utf8'))
    const file = values.manifest + '.progress.json'
    let progress: PurgeProgress
    try { progress = JSON.parse(await readFile(file, 'utf8')) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      progress = { digest: manifest.digest, fenced: false, assetsDeleted: [], auditsDeleted: [], complete: false }
    }
    await applySitePurge(db, manifest, progress, deleteAuditScreenshotAssets, state => persist(file, state))
    console.log(JSON.stringify({ digest: manifest.digest, complete: progress.complete, reportsDeleted: progress.auditsDeleted.length }))
  }
} finally { await db.$disconnect() }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Purge failed'); process.exitCode = 1 })
