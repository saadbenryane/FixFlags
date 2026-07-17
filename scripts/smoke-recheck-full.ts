/**
 * Live proof: parented re-check does a FULL fresh capture (new screenshot URLs)
 * and diffs flags vs parent. Does not use the queue.
 *
 * Run: DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/smoke-recheck-full.ts [parentAuditId]
 */
import assert from 'node:assert/strict'
import { prisma } from '@/lib/db'
import { runAudit } from '@/lib/audit/runner'
import { closeBrowser } from '@/lib/audit/screenshot'

async function main() {
  const parentIdArg = process.argv[2]
  const parent =
    (parentIdArg
      ? await prisma.audit.findUnique({
          where: { id: parentIdArg },
          select: {
            id: true,
            url: true,
            userId: true,
            status: true,
            screenshots: { select: { device: true, url: true } },
            _count: { select: { flags: true } },
          },
        })
      : null) ??
    (await prisma.audit.findFirst({
      where: { status: 'COMPLETED', parentId: null, userId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        userId: true,
        status: true,
        screenshots: { select: { device: true, url: true } },
        _count: { select: { flags: true } },
      },
    }))

  assert.ok(parent, 'Need a COMPLETED owned parent audit')
  assert.equal(parent.status, 'COMPLETED')
  assert.ok(parent.userId, 'Parent must be owned')
  const parentDesktop = parent.screenshots.find((s) => s.device === 'DESKTOP')?.url
  assert.ok(parentDesktop, 'Parent must have a desktop screenshot')

  console.log(`Parent ${parent.id} url=${parent.url} flags=${parent._count.flags}`)
  console.log(`Parent desktop: ${parentDesktop}`)

  const child = await prisma.audit.create({
    data: {
      url: parent.url,
      userId: parent.userId,
      parentId: parent.id,
      skipUsageCount: true,
      monitoringMode: 'FULL',
      auditMode: 'SINGLE',
      status: 'QUEUED',
      progress: 5,
      includeAi: false,
    },
  })

  console.log(`Child ${child.id} created (FULL, SINGLE, includeAi=false). Running runAudit...`)
  const started = Date.now()
  try {
    await runAudit(child.id)
  } finally {
    await closeBrowser().catch(() => undefined)
  }
  console.log(`runAudit finished in ${((Date.now() - started) / 1000).toFixed(1)}s`)

  const done = await prisma.audit.findUnique({
    where: { id: child.id },
    select: {
      status: true,
      monitoringMode: true,
      parentId: true,
      failureCode: true,
      errorMsg: true,
      screenshots: { select: { device: true, url: true } },
      flags: { select: { status: true, checkId: true } },
    },
  })

  assert.ok(done, 'Child missing after run')
  console.log(`Child status=${done.status} mode=${done.monitoringMode} parentId=${done.parentId}`)
  if (done.status !== 'COMPLETED') {
    console.error(`failureCode=${done.failureCode} error=${done.errorMsg}`)
  }
  assert.equal(done.status, 'COMPLETED', 'Child audit should COMPLETE')
  assert.equal(done.monitoringMode, 'FULL')
  assert.equal(done.parentId, parent.id)

  const childDesktop = done.screenshots.find((s) => s.device === 'DESKTOP')?.url
  assert.ok(childDesktop, 'Child must have a desktop screenshot')
  console.log(`Child desktop: ${childDesktop}`)

  assert.notEqual(
    childDesktop,
    parentDesktop,
    'Child desktop screenshot URL must differ from parent (fresh capture)'
  )
  assert.ok(
    childDesktop.includes(child.id),
    'Child screenshot path should include child audit id'
  )
  assert.ok(
    !childDesktop.includes(parent.id),
    'Child screenshot must not reuse parent audit id path'
  )

  const fixed = done.flags.filter((f) => f.status === 'FIXED').length
  const open = done.flags.filter((f) => f.status === 'OPEN').length
  const ignored = done.flags.filter((f) => f.status === 'IGNORED').length
  const regressed = done.flags.filter((f) => f.status === 'REGRESSED').length
  console.log(
    `Flag statuses: FIXED=${fixed} OPEN=${open} IGNORED=${ignored} REGRESSED=${regressed} total=${done.flags.length}`
  )
  console.log('OK: FULL re-check fresh capture proven')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
