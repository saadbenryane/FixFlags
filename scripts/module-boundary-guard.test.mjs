import test from 'node:test'
import assert from 'node:assert/strict'
import { moduleBoundaryFailures } from './module-boundary-guard.mjs'

test('accepts thin routes, server-owned repositories, and type-only Prisma imports', () => {
  assert.deepEqual(moduleBoundaryFailures({
    sources: {
      'app/api/projects/[id]/watch/route.ts': "import { load } from '@/lib/products/application/queries'",
      'components/product/Control.tsx': "'use client'\nimport type { Project } from '@prisma/client'",
      'lib/products/application/queries.ts': "import { prisma } from '@/lib/db'",
    },
  }), [])
})

test('rejects client database imports, route persistence bypasses, cycles, and parked Canvas routes', () => {
  const failures = moduleBoundaryFailures({
    sources: {
      'app/api/projects/[id]/watch/route.ts': "import { prisma } from '@/lib/db'",
      'components/product/Control.tsx': "'use client'\nimport { Prisma } from '@prisma/client'",
      'lib/auth/a.ts': "import '@/lib/auth/b'",
      'lib/auth/b.ts': "import '@/lib/auth/a'",
      'app/api/reports/[id]/canvases/route.ts': 'export const POST = () => null',
    },
    existingFiles: new Set(['app/api/reports/[id]/canvases/route.ts']),
  })

  assert.ok(failures.some((failure) => failure.includes('client module')))
  assert.ok(failures.some((failure) => failure.includes('application boundary')))
  assert.ok(failures.some((failure) => failure.includes('runtime dependency cycle')))
  assert.ok(failures.some((failure) => failure.includes('parked Canvas API')))
})

test('guards website run, verification, monitoring and account adapters', () => {
  for (const route of ['runs', 'watch', 'watch/activate', 'account-checks', 'flags/[flagId]/fix', 'flags/[flagId]/verify', 'outcomes/[outcomeId]/verify']) {
    const file = `app/api/sites/[siteId]/${route}/route.ts`
    assert.ok(moduleBoundaryFailures({ sources: { [file]: "import { prisma } from '@/lib/db'" } }).some(failure => failure.includes('application boundary')))
  }
})
