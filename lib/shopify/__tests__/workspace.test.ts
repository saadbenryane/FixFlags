import { describe, expect, it } from 'vitest'
import { buildShopifyWorkspace } from '../workspace'

const shop = {
  shopDomain: 'demo.myshopify.com',
  name: 'Demo',
  email: 'owner@example.com',
  slackWebhookEncrypted: null,
}

describe('buildShopifyWorkspace', () => {
  it('names an empty catalog', () => {
    const workspace = buildShopifyWorkspace({
      shop,
      paths: [],
      waitlist: [],
      rechecksRemaining: 5,
    })
    expect(workspace.emptyCatalog).toBe(true)
    expect(workspace.storeHeadline).toMatch(/No buyable product/)
  })

  it('names a walk in progress instead of inventing GREEN', () => {
    const workspace = buildShopifyWorkspace({
      shop,
      paths: [
        {
          id: 'p1',
          label: 'Tee',
          storefrontUrl: 'https://store.example/tee',
          health: 'UNKNOWN',
          reason: null,
          failedStep: null,
          lastVerifiedAt: null,
          lastVideoUrl: null,
          lastGifUrl: null,
          lastScreenshotUrl: null,
          lastTransitionAt: null,
          runs: [],
          improveItems: [],
        },
      ],
      waitlist: [],
      rechecksRemaining: 5,
    })
    expect(workspace.walking).toBe(true)
    expect(workspace.storeHeadline).toMatch(/Walking the path/)
    expect(workspace.paths[0]?.videoMissing).toBe(false)
  })

  it('surfaces a RED incident and honest missing video', () => {
    const workspace = buildShopifyWorkspace({
      shop,
      paths: [
        {
          id: 'p1',
          label: 'Tee',
          storefrontUrl: 'https://store.example/tee',
          health: 'RED',
          reason: 'add_to_cart_noop',
          failedStep: 'add_to_cart',
          lastVerifiedAt: new Date('2026-09-05T12:00:00Z'),
          lastVideoUrl: null,
          lastGifUrl: 'https://example/x.gif',
          lastScreenshotUrl: 'https://example/x.png',
          lastTransitionAt: new Date('2026-09-05T12:00:00Z'),
          runs: [
            {
              id: 'r1',
              health: 'RED',
              reason: 'add_to_cart_noop',
              trigger: 'install',
              videoUrl: null,
              gifUrl: 'https://example/x.gif',
              createdAt: new Date('2026-09-05T12:00:00Z'),
              evidence: { steps: [{ label: 'add_to_cart', url: '/p', screenshotUrl: '/s.png' }] },
            },
          ],
          improveItems: [],
        },
      ],
      waitlist: [],
      rechecksRemaining: 4,
    })
    expect(workspace.openIncident?.label).toBe('Tee')
    expect(workspace.storeHeadline).toMatch(/can't buy/)
    expect(workspace.paths[0]?.videoMissing).toBe(false)
    expect(workspace.paths[0]?.gifUrl).toBe('https://example/x.gif')
    expect(workspace.paths[0]?.runs[0]?.steps[0]?.failed).toBe(true)
  })
})
