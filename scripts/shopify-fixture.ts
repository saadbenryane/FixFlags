import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/db'
import { persistTokenSet } from '@/lib/shopify/tokens'
import { signFixtureSession } from '@/lib/shopify/fixture-session'
import { runIntegrityPathJob } from '@/lib/integrity/run-path-job'


const ROOT = path.join(process.cwd(), 'lib/integrity/__tests__/fixtures')
const PORT = Number(process.env.SHOPIFY_FIXTURE_PORT ?? 4010)
const SHOP = 'fixture-store.myshopify.com'

function contentType(file: string): string {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.js')) return 'application/javascript'
  return 'text/plain'
}

function startServer(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
    const map: Record<string, string> = {
      '/green': path.join(ROOT, 'green', 'index.html'),
      '/green/checkout': path.join(ROOT, 'green', 'checkout.html'),
      '/checkout': path.join(ROOT, 'green', 'checkout.html'),
      '/red': path.join(ROOT, 'red-atc', 'index.html'),
      '/unknown': path.join(ROOT, 'unknown', 'index.html'),
    }
    const file = map[url.pathname]
    if (!file || !fs.existsSync(file)) {
      res.statusCode = 404
      res.end('not found')
      return
    }
    res.setHeader('Content-Type', contentType(file))
    res.end(fs.readFileSync(file))
  })
  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve(server))
  })
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('shopify:fixture is not for production')
  }
  process.env.FIXFLAGS_SHOPIFY_FIXTURE = '1'
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    process.env.TOKEN_ENCRYPTION_KEY = '57e4ab27b1e9eedc60457e7360f58bdbf458f8748e1d74f4c799f8f362770dba'
  }
  const server = await startServer()
  const origin = `http://127.0.0.1:${PORT}`

  await persistTokenSet(
    SHOP,
    {
      accessToken: 'fixture-token',
      refreshToken: 'fixture-refresh',
      scope: 'read_products',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      refreshExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
    { name: 'Fixture Store', email: 'fixture@fixflags.com', primaryUrl: origin }
  )

  const shop = await prisma.shopifyShop.findUniqueOrThrow({ where: { shopDomain: SHOP } })
  await prisma.revenuePath.deleteMany({ where: { shopId: shop.id } })
  const green = await prisma.revenuePath.create({
    data: {
      shopId: shop.id,
      label: 'Green tee',
      storefrontUrl: `${origin}/green`,
      source: 'auto',
    },
  })
  const red = await prisma.revenuePath.create({
    data: {
      shopId: shop.id,
      label: 'Broken ATC',
      storefrontUrl: `${origin}/red`,
      source: 'auto',
    },
  })

  await runIntegrityPathJob(green.id, 'install')
  await runIntegrityPathJob(red.id, 'install')

  const token = signFixtureSession(SHOP)
  console.log(`Fixture shop ready: ${SHOP}`)
  console.log(`Open: http://localhost:3000/shopify?shop=${SHOP}`)
  console.log(`Fixture token (Authorization Bearer): ${token}`)
  console.log(`Keep this process running to serve ${origin}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
