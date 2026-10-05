import { prisma } from '@/lib/db'
import { loadWatchLaunchReadiness } from '@/lib/analytics/watch-launch-readiness'

const requirePass = process.argv.includes('--require-pass')

async function main() {
  try {
    const readiness = await loadWatchLaunchReadiness()
    process.stdout.write(`${JSON.stringify(readiness, null, 2)}\n`)
    if (requirePass && readiness.status !== 'passed') process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void main()
