import { createServer } from 'node:http'
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { parseEmailBudget, reserveVerificationEmail } from './email-budget.mjs'

// Separate controlled website, never a customer route or an application fixture.
const origin = new URL(process.env.RELEASE_TARGET_ORIGIN ?? '').origin
const database = new URL(process.env.DATABASE_URL ?? '')
const token = process.env.RELEASE_TARGET_CONTROL_TOKEN
const mailbox = process.env.RELEASE_TARGET_MAILBOX ?? 'validationchecks@fixflags.com'
const emailBudget = parseEmailBudget(process.env.RELEASE_TARGET_EMAIL_BUDGET)
if (new URL(origin).protocol !== 'https:' || database.pathname !== '/fixflags_release_target' || !token || token.length < 32 || !process.env.RESEND_API_KEY)
  throw new Error('An isolated release-target database, HTTPS origin, provider and control token are required')
const db = new PrismaClient()
const digest = value => createHash('sha256').update(value).digest('hex')
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const json = (response, status, value) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(value)) }
const redirect = (response, url, cookie) => { response.writeHead(303, { location: url, ...(cookie ? { 'set-cookie': cookie } : {}), 'cache-control': 'no-store' }); response.end() }
const passwordHash = (password, salt) => scryptSync(password, salt, 32).toString('hex')
await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS release_target_accounts (
  id text PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL, salt text NOT NULL,
  verification_hash text, verification_expires_at timestamptz, verified_at timestamptz, deleted_at timestamptz,
  provider_email_id text, created_at timestamptz NOT NULL DEFAULT now())`)
await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS release_target_sessions (
  token_hash text PRIMARY KEY, account_id text REFERENCES release_target_accounts(id), expires_at timestamptz NOT NULL)`)
await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS release_target_settings (id integer PRIMARY KEY, value jsonb NOT NULL)`)
await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS release_target_email_budget (id integer PRIMARY KEY, used integer NOT NULL DEFAULT 0 CHECK (used >= 0))`)
await db.$executeRaw`INSERT INTO release_target_email_budget (id, used) VALUES (1, 0) ON CONFLICT DO NOTHING`
await db.$executeRaw`INSERT INTO release_target_settings (id, value) VALUES (1, '{"broken":false,"missingTitle":false,"outage":false,"deletionUnavailable":false}'::jsonb) ON CONFLICT DO NOTHING`

async function settings() { return (await db.$queryRaw`SELECT value FROM release_target_settings WHERE id = 1`)[0].value }
async function session(request) {
  const raw = request.headers.cookie?.match(/(?:^|;\s*)__Host-release-target=([^;]+)/)?.[1]
  if (!raw) return null
  const hash = digest(raw)
  return (await db.$queryRaw`SELECT a.* FROM release_target_accounts a JOIN release_target_sessions s ON a.id = s.account_id
    WHERE s.token_hash = ${hash} AND s.expires_at > now() AND a.deleted_at IS NULL AND a.verified_at IS NOT NULL`)[0] ?? null
}
async function sessionCookie(accountId) {
  const raw = randomBytes(32).toString('hex'), hash = digest(raw)
  await db.$executeRaw`INSERT INTO release_target_sessions (token_hash, account_id, expires_at) VALUES (${hash}, ${accountId}, now() + interval '1 hour')`
  return `__Host-release-target=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`
}
function page(response, content, config, status = 200) {
  response.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin',
    'strict-transport-security': 'max-age=31536000; includeSubDomains', 'x-frame-options': 'DENY' })
  response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8">${config.missingTitle ? '' : '<title>Trail Supply controlled verification website</title>'}
    <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Controlled website for independent monitoring and synthetic account lifecycle proof.">
    <style>body{margin:0;font:18px system-ui;color:#18232c;background:#fafaf8}main{max-width:760px;margin:60px auto;padding:24px}a,button{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;color:white;background:#163b2f;border:0;border-radius:8px}label{display:block;margin:18px 0}input{display:block;min-height:44px;max-width:100%;font:inherit}nav{display:flex;flex-wrap:wrap;gap:12px}footer{margin-top:40px}:focus-visible{outline:3px solid #1459b8;outline-offset:4px}</style>
    </head><body><main><p>Controlled release evidence, no real orders or customer accounts.</p>${content}<footer><a href="/privacy">Privacy</a> <p>Contact: verification@fixflags.com</p></footer></main></body></html>`)
}
function accountForm(kind, error = '') {
  const signup = kind === 'signup'
  return `<h1>${signup ? 'Create account' : 'Log in'}</h1>${error ? `<p role="alert">${escape(error)}</p>` : ''}
    <form method="post" action="/${kind}"><label>Email<input type="email" name="email" autocomplete="email" required></label>
    <label>Password<input type="password" name="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required></label>
    <button type="submit">${signup ? 'Sign up' : 'Log in'}</button></form>`
}
async function body(request) {
  let text = ''
  for await (const chunk of request) { text += chunk; if (Buffer.byteLength(text) > 16_384) throw new Error('Body exceeds fixture limit') }
  return text
}
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, origin)
    if (url.pathname === '/health') return json(response, 200, { ok: true, controlledReleaseTarget: true })
    if (url.pathname === '/control') {
      const supplied = Buffer.from(request.headers.authorization ?? ''), expected = Buffer.from('Bearer ' + token)
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return json(response, 403, { error: 'Unauthorized' })
      if (request.method === 'POST') {
        const update = JSON.parse(await body(request)), current = await settings()
        for (const key of ['broken', 'missingTitle', 'outage', 'deletionUnavailable']) if (typeof update[key] === 'boolean') current[key] = update[key]
        await db.$executeRaw`UPDATE release_target_settings SET value = ${JSON.stringify(current)}::jsonb WHERE id = 1`
      }
      const counts = await db.$queryRaw`SELECT count(*)::int AS total, count(*) FILTER (WHERE deleted_at IS NULL)::int AS remaining,
        count(*) FILTER (WHERE verified_at IS NOT NULL)::int AS verified, count(*) FILTER (WHERE provider_email_id IS NOT NULL)::int AS sent FROM release_target_accounts`
      const budget = (await db.$queryRaw`SELECT used FROM release_target_email_budget WHERE id = 1`)[0]
      return json(response, 200, { configuration: await settings(), accounts: counts[0], emailBudget: { limit: emailBudget, used: budget.used } })
    }
    const config = await settings()
    if (config.outage) return page(response, '<h1>Controlled outage</h1>', config, 503)
    if (url.pathname === '/robots.txt') { response.writeHead(200, { 'content-type': 'text/plain' }); response.end(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`); return }
    if (url.pathname === '/sitemap.xml') { response.writeHead(200, { 'content-type': 'application/xml' }); response.end(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url><url><loc>${origin}/privacy</loc></url></urlset>`); return }
    if (request.method === 'POST' && request.headers.origin !== origin) return json(response, 403, { error: 'Origin refused' })
    if (request.method === 'POST' && ['/signup', '/login'].includes(url.pathname)) {
      const form = new URLSearchParams(await body(request)), email = (form.get('email') ?? '').toLowerCase(), password = form.get('password') ?? ''
      const [local, domain] = mailbox.toLowerCase().split('@')
      if (!email.startsWith(local + '+') || !email.endsWith('@' + domain) || email.length > 254 || password.length < 8 || password.length > 256)
        return page(response, accountForm(url.pathname.slice(1), 'Invalid email or password'), config, 400)
      const account = (await db.$queryRaw`SELECT * FROM release_target_accounts WHERE email = ${email}`)[0]
      if (url.pathname === '/login') {
        if (!account || account.deleted_at) return page(response, accountForm('login', 'Account does not exist'), config)
        const candidate = Buffer.from(passwordHash(password, account.salt), 'hex'), expected = Buffer.from(account.password_hash, 'hex')
        if (!timingSafeEqual(candidate, expected)) return page(response, accountForm('login', 'Invalid credentials'), config)
        if (!account.verified_at) return page(response, '<h1>Check your inbox</h1><p>Verify your email to continue.</p>', config)
        return redirect(response, '/dashboard', await sessionCookie(account.id))
      }
      if (account) return page(response, accountForm('signup', 'Registration failed, identity already exists'), config, 409)
      if (!await reserveVerificationEmail(db, emailBudget))
        return page(response, '<h1>Email verification unavailable</h1><p>The controlled email budget is closed or exhausted.</p>', config, 503)
      const id = randomUUID(), salt = randomBytes(16).toString('hex'), hash = passwordHash(password, salt), verification = randomBytes(32).toString('hex'), verificationHash = digest(verification)
      await db.$executeRaw`INSERT INTO release_target_accounts (id, email, password_hash, salt, verification_hash, verification_expires_at)
        VALUES (${id}, ${email}, ${hash}, ${salt}, ${verificationHash}, now() + interval '15 minutes')`
      const sent = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'content-type': 'application/json', 'idempotency-key': 'controlled-verification-' + id }, signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [email], subject: 'Verify your controlled Trail Supply account',
          html: `<p>This email verifies a synthetic release account.</p><a href="${origin}/verify?token=${verification}">Verify email</a>` }) })
      const receipt = await sent.json()
      if (!sent.ok || !receipt.id) return page(response, '<h1>Email verification unavailable</h1><p>The provider did not accept this message.</p>', config, 503)
      await db.$executeRaw`UPDATE release_target_accounts SET provider_email_id = ${receipt.id} WHERE id = ${id}`
      return page(response, '<h1>Check your inbox</h1><p>Verify your email to continue.</p>', config)
    }
    if (url.pathname === '/verify') {
      const hash = digest(url.searchParams.get('token') ?? '')
      const accounts = await db.$queryRaw`UPDATE release_target_accounts SET verified_at = now(), verification_hash = NULL WHERE verification_hash = ${hash}
        AND verification_expires_at > now() AND deleted_at IS NULL RETURNING id`
      if (!accounts.length) return page(response, '<h1>Verification link expired</h1>', config, 410)
      return redirect(response, '/dashboard', await sessionCookie(accounts[0].id))
    }
    if (['/dashboard', '/settings', '/delete-account', '/logout'].includes(url.pathname)) {
      const account = await session(request)
      if (!account) return redirect(response, '/login')
      if (request.method === 'POST' && url.pathname === '/logout') {
        const hash = digest(request.headers.cookie?.match(/(?:^|;\s*)__Host-release-target=([^;]+)/)?.[1] ?? '')
        await db.$executeRaw`DELETE FROM release_target_sessions WHERE token_hash = ${hash}`
        return redirect(response, '/login', '__Host-release-target=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0')
      }
      if (request.method === 'POST' && url.pathname === '/delete-account' && !config.deletionUnavailable) {
        await db.$transaction(async tx => {
          await tx.$executeRaw`UPDATE release_target_accounts SET deleted_at = now() WHERE id = ${account.id}`
          await tx.$executeRaw`DELETE FROM release_target_sessions WHERE account_id = ${account.id}`
        })
        return redirect(response, '/login', '__Host-release-target=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0')
      }
      const deletion = url.pathname === '/settings' && !config.deletionUnavailable ? '<form method="post" action="/delete-account"><button type="submit">Delete account</button></form>' : ''
      return page(response, `<h1>${url.pathname === '/settings' ? 'Account settings' : 'Your dashboard'}</h1><nav><a href="/dashboard">Dashboard</a><a href="/settings">Account settings</a></nav>
        <form method="post" action="/logout"><button type="submit">Log out</button></form>${deletion}`, config)
    }
    if (url.pathname === '/signup' || url.pathname === '/login') return page(response, accountForm(url.pathname.slice(1)), config)
    if (url.pathname === '/checkout') return page(response, `<h1>${config.broken ? 'Checkout unavailable' : 'Checkout'}</h1><p>This controlled fixture never places an order.</p>${config.broken ? '' : '<p>Payment</p><label>Card number<input inputmode="numeric" autocomplete="cc-number" disabled></label><button type="button" disabled>Pay now</button>'}`, config, config.broken ? 503 : 200)
    if (url.pathname === '/privacy') return page(response, '<h1>Privacy</h1><p>This controlled website stores only synthetic test identities and verification receipts.</p>', config)
    return page(response, '<h1>Equipment for your next outdoor adventure</h1><p>Trail Pack, $75. Choose your hiking pack and review checkout.</p><button type="button" id="add">Add to cart</button><div id="CartDrawer" hidden><p>Item added</p><p>Your cart (1)</p><a href="/checkout">Checkout</a></div><script>document.getElementById("add").onclick=()=>{document.getElementById("CartDrawer").hidden=false}</script><nav><a href="/signup">Create account</a><a href="/login">Log in</a></nav>', config)
  } catch { if (!response.headersSent) json(response, 500, { error: 'Controlled fixture operation failed' }); else response.end() }
})
server.listen(Number(process.env.PORT ?? 8080), '0.0.0.0')
process.on('SIGTERM', () => { server.close(async () => { await db.$disconnect(); process.exit(0) }); server.closeIdleConnections() })
