import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const requirePass = process.argv.includes('--require-pass')
const releaseGate = process.argv.includes('--release-gate')

function requiredReleaseValue(name: string, pattern?: RegExp): string {
  const value = process.env[name]?.trim()
  if (!value || (pattern && !pattern.test(value))) {
    throw new Error(`${name} is required for the release Watch gate`)
  }
  return value
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')
}

async function main() {
  if (releaseGate) {
    process.env.DATABASE_URL = requiredReleaseValue('RELEASE_WATCH_READ_DATABASE_URL')
  }
  // These imports must happen after the release database override. Prisma binds
  // its datasource when the client module is evaluated.
  const [{ prisma }, { loadWatchLaunchReadiness }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/analytics/watch-launch-readiness'),
  ])
  try {
    const readiness = releaseGate
      ? await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
          return loadWatchLaunchReadiness(new Date(), tx)
        })
      : await loadWatchLaunchReadiness()
    process.stdout.write(`${JSON.stringify(readiness, null, 2)}\n`)

    if (releaseGate) {
      const gitSha = requiredReleaseValue('RELEASE_EXPECTED_GIT_SHA', /^[a-f0-9]{40}$/)
      const databaseIdentityHash = requiredReleaseValue(
        'RELEASE_WATCH_DATABASE_IDENTITY_HASH',
        /^[a-f0-9]{64}$/,
      )
      const evidenceFile = path.resolve(
        requiredReleaseValue('RELEASE_WATCH_READINESS_EVIDENCE_FILE'),
      )
      mkdirSync(path.dirname(evidenceFile), { recursive: true, mode: 0o700 })
      writeFileSync(
        evidenceFile,
        `${JSON.stringify({ schemaVersion: 1, gitSha, databaseIdentityHash, ...readiness }, null, 2)}\n`,
        { mode: 0o600 },
      )
      chmodSync(evidenceFile, 0o600)
    }
    if (requirePass && readiness.status !== 'passed') process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void main().catch((error) => {
  process.stderr.write(`Watch launch readiness failed: ${safeMessage(error)}\n`)
  process.exitCode = 1
})
