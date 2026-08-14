import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test'

// ============================================================================
// Billing batch-gate (test-mode) — waitlist join → checkout gate behavior.
//
// STATUS: BLOCKED in this session (no test-mode app + fixture env available).
// The spec is fully written and typecheck-clean. Standard browser checks skip
// it unless E2E_BILLING_GATE=true. The release command enables it and preflight
// requires every fixture, so release verification cannot silently skip billing.
//
// What this spec verifies (shipped behavior, see docs/launch-checklist.md):
//   1. Waitlist join assigns an access batch + discount tier snapshot (join
//      position, atomic under a per-plan advisory lock). The spec normalizes
//      the batch via the admin API so assertions are deterministic regardless
//      of how many rows already exist in the DB.
//   2. Checkout enforces STRIPE_PAID_OPEN (master switch) first, then the
//      WAITLIST_OPEN_BATCH cohort: a member whose batch is released passes;
//      a member whose batch is not released gets 403 BATCH_ACCESS_REQUIRED.
//   3. An explicit admin grant (accessGrantedAt) bypasses the unreleased batch.
//   4. A user with NO waitlist row passes when the master switch is on
//      (intentional legacy behavior — see note on test 5; this differs from
//      the earlier O-2 runbook expectation that non-members get 403).
//   5. When STRIPE_PAID_OPEN=false every checkout returns 403
//      PAID_CHECKOUT_CLOSED (client CTAs route to the waitlist).
//   6. Tier promotion auto-applies for a released tier-1 member (verified on
//      the Stripe Checkout Session via the test-mode API key).
//
// Required env to run (test-mode app):
//   E2E_BILLING_GATE=true                       — opt-in flag for this spec
//   E2E_BASE_URL                                — test-mode app URL. The app
//     must have: STRIPE_PAID_OPEN=true, NEXT_PUBLIC_PAID_OPEN=true,
//     WAITLIST_OPEN_BATCH=1, PLAN_RELEASE_DATE set to a date <= today,
//     STRIPE_TIER1_PRO_PROMOTION_ID (+ tier2) set to test promo ids,
//     STRIPE_SECRET_KEY/NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in test mode.
//   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD        — an ADMIN-role account (the
//     admin API route is the only outside way to normalize batches).
//   E2E_GATE_MEMBER_RELEASED_EMAIL / _PASSWORD  — probe user A (defaults to
//     E2E_BILLING_FREE_EMAIL / _PASSWORD when unset). Should NOT hold a paid
//     subscription (the released-member test asserts a 200 checkout URL).
//   E2E_GATE_MEMBER_RELEASED_ENTRY_ID           — A's waitlist entry id, from
//     the admin waitlist UI (the admin export CSV intentionally omits ids).
//   E2E_GATE_MEMBER_BLOCKED_EMAIL / _PASSWORD   — probe user B (defaults to
//     E2E_SHARE_OWNER_EMAIL / _PASSWORD when unset).
//   E2E_GATE_MEMBER_BLOCKED_ENTRY_ID            — B's waitlist entry id.
//   E2E_GATE_NON_MEMBER_EMAIL / _PASSWORD       — probe user C, never joined
//     (defaults to E2E_WATCH_EMAIL / _PASSWORD when unset).
//
// Optional env:
//   E2E_PAID_OPEN_EXPECTED='false'  — run against a test app with
//     STRIPE_PAID_OPEN=false to assert the master-switch-off 403. Default
//     'true' (skips that test with a reason).
//   E2E_STRIPE_SECRET_KEY           — test-mode secret key; enables test 6,
//     which reads the created Checkout Session back from the Stripe API to
//     assert the auto-applied 25% promotion. Requires the app's tier-1 promo
//     env and PLAN_RELEASE_DATE <= today.
//
// How to run (operator):
//   1. Provision the test-mode env above (per scripts/release-preflight.mjs
//      var list plus the E2E_GATE_* / E2E_ADMIN_* vars).
//   2. Join probe users A and B to the BUILDER waitlist once (UI or
//      `POST /api/stripe/waitlist`), then copy their entry ids from the admin
//      waitlist page into E2E_GATE_MEMBER_*_ENTRY_ID.
//   3. `E2E_BILLING_GATE=true npx playwright test e2e/billing-gate.spec.ts`
//      (add E2E_BASE_URL for a remote app; the local webServer boots with the
//      DEV_SIMULATE_BILLING env, which is NOT a faithful paid-open app — use a
//      dedicated test-mode deployment or the release container env file).
//
// Caveats:
//   - Entitlement grant after a real card payment is NOT covered here: it
//     requires completing Stripe's hosted checkout (4242 test card) and the
//     subscription webhook. That stays an operator step (see the launch
//     checklist section d). The webhook path itself is unit-tested.
//   - Rate limits: waitlist join is 5/min and checkout 10/min per client id;
//     the spec runs serially and keeps joins to 3 calls.
//   - Run against a fresh database (release flow) so probe users have no
//     subscription and non-member user C has no waitlist row for BUILDER.
// ============================================================================

const gateEnabled = process.env.E2E_BILLING_GATE === 'true'
const paidOpenExpected = process.env.E2E_PAID_OPEN_EXPECTED !== 'false'

function envOr(name: string, fallbackName: string | undefined): string | undefined {
  const direct = process.env[name]?.trim()
  if (direct) return direct
  return fallbackName ? process.env[fallbackName]?.trim() : undefined
}

const releasedEmail = envOr('E2E_GATE_MEMBER_RELEASED_EMAIL', 'E2E_BILLING_FREE_EMAIL')
const releasedPassword = envOr('E2E_GATE_MEMBER_RELEASED_PASSWORD', 'E2E_BILLING_FREE_PASSWORD')
const blockedEmail = envOr('E2E_GATE_MEMBER_BLOCKED_EMAIL', 'E2E_SHARE_OWNER_EMAIL')
const blockedPassword = envOr('E2E_GATE_MEMBER_BLOCKED_PASSWORD', 'E2E_SHARE_OWNER_PASSWORD')
const nonMemberEmail = envOr('E2E_GATE_NON_MEMBER_EMAIL', 'E2E_WATCH_EMAIL')
const nonMemberPassword = envOr('E2E_GATE_NON_MEMBER_PASSWORD', 'E2E_WATCH_PASSWORD')
const adminEmail = process.env.E2E_ADMIN_EMAIL?.trim()
const adminPassword = process.env.E2E_ADMIN_PASSWORD?.trim()
const releasedEntryId = process.env.E2E_GATE_MEMBER_RELEASED_ENTRY_ID?.trim()
const blockedEntryId = process.env.E2E_GATE_MEMBER_BLOCKED_ENTRY_ID?.trim()
const stripeTestKey = process.env.E2E_STRIPE_SECRET_KEY?.trim()

const GATE_SKIP_REASON =
  'E2E_BILLING_GATE=true plus a test-mode app (STRIPE_PAID_OPEN=true, ' +
  'WAITLIST_OPEN_BATCH=1, PLAN_RELEASE_DATE set, promo env set) and fixture ' +
  'users/entry ids are required. See the spec header for the full env list ' +
  'and operator run steps.'

function requiredCreds(): boolean {
  return Boolean(
    releasedEmail &&
      releasedPassword &&
      blockedEmail &&
      blockedPassword &&
      nonMemberEmail &&
      nonMemberPassword &&
      adminEmail &&
      adminPassword &&
      releasedEntryId &&
      blockedEntryId
  )
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

async function signedInRequest(
  browser: Browser,
  email: string,
  password: string
): Promise<{ request: APIRequestContext; close(): Promise<void> }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signIn(page, email, password)
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 })
  return { request: page.request, close: () => context.close() }
}

type CheckoutJson = { code?: string; url?: string; message?: string }

/** Idempotent join: re-joins keep the tier/batch snapshot; admin normalizes batch. */
async function joinWaitlist(request: APIRequestContext, email: string): Promise<void> {
  const response = await request.post('/api/stripe/waitlist', {
    data: { email, plan: 'BUILDER', name: '', campaign: 'e2e_billing_gate' },
  })
  expect(response.ok(), await response.text()).toBe(true)
}

async function startCheckout(
  request: APIRequestContext,
  plan: 'BUILDER' | 'TEAM' = 'BUILDER'
): Promise<{ status: number; json: CheckoutJson }> {
  const response = await request.post('/api/stripe/checkout', { data: { plan } })
  return { status: response.status(), json: (await response.json().catch(() => ({}))) as CheckoutJson }
}

/** Admin batch normalization so assertions are independent of DB join position. */
async function adminAssignBatch(
  request: APIRequestContext,
  entryId: string,
  batch: 1 | 2
): Promise<void> {
  const response = await request.post(`/api/admin/waitlist/${entryId}/invite`, {
    data: { action: 'assign_batch', batch },
  })
  expect(response.ok(), await response.text()).toBe(true)
}

async function adminGrant(request: APIRequestContext, entryId: string): Promise<void> {
  const response = await request.post(`/api/admin/waitlist/${entryId}/invite`, {
    data: { action: 'grant' },
  })
  expect(response.ok(), await response.text()).toBe(true)
}

test.describe('billing batch gate (test mode, opt-in E2E_BILLING_GATE)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(() => {
    test.skip(!gateEnabled || !requiredCreds(), GATE_SKIP_REASON)
  })

  test('released batch-1 member reaches Stripe checkout', async ({ browser }) => {
    const member = await signedInRequest(browser, releasedEmail!, releasedPassword!)
    try {
      await joinWaitlist(member.request, releasedEmail!)
      await adminAssignBatch(member.request, releasedEntryId!, 1)

      const { status, json } = await startCheckout(member.request)
      expect(status).toBe(200)
      expect(json.url).toMatch(/^https:\/\/checkout\.stripe\.com\//)
    } finally {
      await member.close()
    }
  })

  test('unreleased batch-2 member is blocked with 403 BATCH_ACCESS_REQUIRED', async ({ browser }) => {
    const member = await signedInRequest(browser, blockedEmail!, blockedPassword!)
    try {
      await joinWaitlist(member.request, blockedEmail!)
      await adminAssignBatch(member.request, blockedEntryId!, 2)

      const { status, json } = await startCheckout(member.request)
      expect(status).toBe(403)
      expect(json.code).toBe('BATCH_ACCESS_REQUIRED')
      expect(json.url).toBeUndefined()
    } finally {
      await member.close()
    }
  })

  test('explicit admin grant lets the unreleased member through the gate', async ({ browser }) => {
    const member = await signedInRequest(browser, blockedEmail!, blockedPassword!)
    try {
      await adminGrant(member.request, blockedEntryId!)

      const { status, json } = await startCheckout(member.request)
      // Gate passed; an existing subscription would redirect to the portal (409).
      expect(status === 200 || status === 409).toBe(true)
      expect(json.url).toMatch(/^https:\/\/(checkout|billing)\.stripe\.com\//)
    } finally {
      await member.close()
    }
  })

  test('non-member with no waitlist row passes while the master switch is on (legacy behavior)', async ({
    browser,
  }) => {
    const member = await signedInRequest(browser, nonMemberEmail!, nonMemberPassword!)
    try {
      // NOTE: shipped code treats "no waitlist row" as legacy global-open —
      // `isCheckoutEligible(null) === true` — so a non-member is NOT 403'd.
      // This differs from the earlier O-2 runbook step ("non-member gets 403")
      // and from the flip-runbook task text; documented in docs/launch-checklist.md.
      const { status, json } = await startCheckout(member.request)
      expect(status === 200 || status === 409).toBe(true)
      expect(json.url).toMatch(/^https:\/\/(checkout|billing)\.stripe\.com\//)
    } finally {
      await member.close()
    }
  })

  if (!paidOpenExpected) {
    test('master switch off blocks everyone with 403 PAID_CHECKOUT_CLOSED', async ({ browser }) => {
      const member = await signedInRequest(browser, releasedEmail!, releasedPassword!)
      try {
        const { status, json } = await startCheckout(member.request)
        expect(status).toBe(403)
        expect(json.code).toBe('PAID_CHECKOUT_CLOSED')
      } finally {
        await member.close()
      }
    })
  }

  test('tier promotion auto-applies for a released tier-1 member (Stripe-verified)', async ({
    browser,
    request,
  }) => {
    expect(stripeTestKey, 'E2E_STRIPE_SECRET_KEY must pass release preflight').toMatch(/^sk_test_/)
    const member = await signedInRequest(browser, releasedEmail!, releasedPassword!)
    try {
      await adminAssignBatch(member.request, releasedEntryId!, 1)
      const { status, json } = await startCheckout(member.request)
      expect(status).toBe(200)
      expect(json.url).toBeDefined()

      const sessionId = new URL(json.url!).pathname.split('/').pop()
      expect(sessionId).toMatch(/^cs_(test|live)_/)

      const sessionResponse = await request.get(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${stripeTestKey}` },
      })
      expect(sessionResponse.ok(), await sessionResponse.text()).toBe(true)
      const session = (await sessionResponse.json()) as {
        metadata?: Record<string, string>
        discounts?: Array<{ coupon?: { percent_off?: number | null } }>
      }
      expect(session.metadata?.discount_tier).toBe('1')
      expect(session.discounts?.length ?? 0).toBeGreaterThan(0)
      expect(session.discounts?.[0]?.coupon?.percent_off).toBe(25)
    } finally {
      await member.close()
    }
  })
})
