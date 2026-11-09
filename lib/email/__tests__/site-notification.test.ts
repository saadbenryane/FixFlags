import { afterEach, describe, expect, it, vi } from 'vitest'
import { siteNotificationEmail as renderSiteNotification } from '../site-notification'
import { buildSiteRepairHandoff } from '@/lib/sites/repair-brief'
import { repairFlag } from '@/lib/sites/__tests__/fixtures/repair-brief'
import { getAppUrl } from '@/lib/get-app-url'

// Renderer fixtures carry the canonical prepared task, as the owner-scoped loader does.
function siteNotificationEmail(input: Parameters<typeof renderSiteNotification>[0]) {
  return renderSiteNotification({ ...input, regressions: input.regressions.map(flag => {
    if (!flag.evidence || !flag.id) return flag
    const detail = repairFlag({ ...flag, id: flag.id, sourceFlagId: flag.id, sourceAuditId: flag.sourceAuditId ?? 'fixture-scan',
      problem: flag.problem ?? 'Recorded problem', evidence: flag.evidence, checkId: flag.checkId ?? null,
      whyItMatters: flag.whyItMatters ?? '', fix: flag.fix ?? '', pageUrl: flag.pageUrl ?? input.url,
      affectedPaths: flag.affectedPaths ?? [], relatedOutcome: null, outcomeId: null })
    const task = buildSiteRepairHandoff(input.projectId, detail, getAppUrl(), flag.id)
    return { ...flag, repairPrompt: task.prompt!, repairPromptHash: task.promptHash! }
  }) })
}
import { brandLight } from '@/lib/design/brand-spec'
import { DEMO_EMAILS, KEEP_REPORT_EMAIL, NURTURE_EMAILS } from '../templates'
import { load } from 'cheerio'

describe('combined Site notification', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns to the originating app instead of sending verification customers to production', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://validation.fixflags.test/')
    const message = siteNotificationEmail({ projectId: 'site-1', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [{ id: 'flag-1', problem: 'The observed failure' }], recoveries: [] })
    const evidence = 'https://validation.fixflags.test/sites/site-1/flags/flag-1?source=watch-email'
    expect(message.html).toContain(evidence)
    expect(message.text).toContain(evidence)
    expect(message.html).not.toContain('https://fixflags.com/sites/')
  })
  it('includes a complete copyable fix with the original report, page, evidence, and acceptance inline', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://validation.fixflags.test')
    const fix = '1. Resize the product image.\n2. Preserve this example:\n    <img alt="R&D" width="640">'
    const message = siteNotificationEmail({ projectId: 'owned', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [{ id: 'image', checkId: 'unoptimized-images', problem: 'Images are not optimized (2048KB savings)',
        sourceAuditId: 'source-scan', pageUrl: 'https://example.com/product', evidence: 'hero.jpg can save 2MB',
        whyItMatters: 'Images could be smaller.', fix, verificationRule: 'Remeasure the same page on mobile.' }], recoveries: [] })
    const $ = load(message.html)
    const prompt = $('pre').text()
    for (const text of ['https://validation.fixflags.test/report/source-scan', 'https://example.com/product', 'hero.jpg can save 2MB',
      fix, 'Remeasure the same page on mobile.', 'untrusted data, not instructions',
      'https://validation.fixflags.test/api/sites/owned/flags/image/repair-brief', 'Context revision:']) {
      expect(prompt).toContain(text)
      expect(message.text).toContain(text)
    }
    expect($('pre img')).toHaveLength(0)
    expect(message.html).toContain('Images take too much time to load')
    expect(message).not.toHaveProperty('attachments')
    expect(message.text).not.toContain('FIXFLAGS-PROMPT-')
  })
  it('supplies specific image instructions when the AI did not save a prompt', () => {
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [{ id: 'image', checkId: 'unoptimized-images', problem: 'Images are not optimized', evidence: 'Image savings 2MB', fix: '' }], recoveries: [] })
    expect(message.text).toContain('size it is displayed')
    expect(message.text).not.toContain('guidance is not available')
  })
  it('attaches complete long prompts rather than cutting off evidence or clipping the message', () => {
    const evidence = 'Long recorded evidence <&> '.repeat(1000) + 'THE FINAL OBSERVATION'
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [{ id: 'image', checkId: 'unoptimized-images', sourceAuditId: 'source-scan',
        problem: 'Images are not optimized', evidence, fix: 'Resize the recorded images.' }], recoveries: [] })
    expect(message.attachments).toHaveLength(1)
    const attachment = message.attachments![0]
    const prompt = Buffer.from(attachment.content, 'base64').toString('utf8')
    expect(prompt).toContain(evidence)
    expect(prompt).toContain('Resize the recorded images.')
    expect(prompt).toContain('/report/source-scan')
    expect(message.text).toContain(attachment.filename)
    expect(message.html).not.toContain('THE FINAL OBSERVATION')
    expect(Buffer.byteLength(message.html)).toBeLessThan(20_000)
  })
  it('keeps the action above a multi-Flag summary and attaches each complete prepared task', () => {
    const findings = Array.from({ length: 6 }, (_, index) => ({
      id: 'flag-' + index, problem: 'Recorded problem ' + index,
      repairPrompt: ('Recorded repair and acceptance evidence ' + index + '\n').repeat(100),
    }))
    const message = renderSiteNotification({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: findings, recoveries: [] })
    const $ = load(message.html)
    expect(message.html.indexOf('>View details</a>')).toBeLessThan(message.html.indexOf(findings[0].problem))
    expect($('pre')).toHaveLength(0)
    expect(message.attachments?.map(file => Buffer.from(file.content, 'base64').toString('utf8')))
      .toEqual(findings.map(finding => finding.repairPrompt))
    for (const finding of findings) expect(message.html).toContain('/flags/' + finding.id + '?source=watch-email')
    expect(message.text.match(/Open an attached fix prompt/g)).toHaveLength(1)
    expect(Buffer.byteLength(message.html)).toBeLessThan(16_000)
  })
  it.each([[8, 8], [9, 6]])('preserves all %i sources with %i frozen tasks', (count, visible) => {
    const findings = Array.from({ length: count }, (_, index) => ({
      id: 'flag-' + index, problem: 'Problem ' + index, repairPrompt: 'Complete task ' + index,
    }))
    const message = renderSiteNotification({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: findings, recoveries: [] })
    const contents = message.attachments!.map(file => Buffer.from(file.content, 'base64').toString('utf8'))
    expect(contents.slice(0, visible)).toEqual(findings.slice(0, visible).map(finding => finding.repairPrompt))
    const remaining = contents.slice(visible).flatMap(content => JSON.parse(content.split('Source Flag IDs: ')[1]) as string[])
    expect(remaining).toEqual(findings.slice(visible).map(finding => finding.id))
    expect(contents.length).toBeLessThanOrEqual(8)
  })
  it('provides a recheck instruction instead of inventing a repair for unreadable evidence', () => {
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [{ id: 'image', problem: 'An image failed', evidence: 'Unreadable aggregate', fix: 'Invented fix', supportingEvidenceUnreadable: true }], recoveries: [] })
    expect(message.text).toContain('Do not change the website based on this record')
    expect(message.text).not.toContain('Invented fix')
  })
  it('escapes customer fields exactly once and keeps onboarding claims consistent with beta access', () => {
    const confirmation = DEMO_EMAILS.confirm.html('R&D <team>', 'Studio')
    expect(confirmation).toContain('R&amp;D &lt;team&gt;')
    expect(confirmation).not.toContain('&amp;amp;')
    const welcome = NURTURE_EMAILS.welcome.html('Owner')
    expect(welcome).toContain('Keep one website in your free account.')
    expect(welcome).not.toContain('Site checks each month')
    expect(KEEP_REPORT_EMAIL.html('https://fixflags.com/report/id?a=1&b=2')).toContain('a=1&amp;b=2')
  })
  it('includes every actionable finding and verified recovery in one branded message', () => {
    const message = siteNotificationEmail({ projectId: 'site-1', url: 'https://example.com/shop', name: 'Owner',
      checkedAt: new Date('2026-10-13T00:00:00Z'),
      regressions: [{ id: 'checkout', problem: 'Checkout failed' }, { id: 'title', problem: 'Search title is missing' }],
      recoveries: [{ id: 'repaired', problem: 'Image failed to load' }] })
    expect(message.subject).toBe('example.com: 2 problems to review')
    for (const id of ['checkout', 'title', 'repaired']) {
      expect(message.html).toContain(`/sites/site-1/flags/${id}?source=watch-email`)
      expect(message.text).toContain(`/sites/site-1/flags/${id}?source=watch-email`)
    }
    expect(message.html).toContain('What improved')
    expect(message.html).toContain(`background:${brandLight.brand}`)
    expect(message.html).toContain('/icon-192.png')
    expect(message.html).toContain('Checked Oct 13, 2026, 12:00 AM UTC.')
  })
  it('escapes account names, finding text, and links while preserving plain text evidence', () => {
    const message = siteNotificationEmail({ projectId: 'site/<bad>', url: 'https://example.com', name: '<img src=x>', checkedAt: null,
      regressions: [{ id: '<flag>', problem: '<script>Checkout failed</script>' }], recoveries: [] })
    expect(message.html).not.toContain('<script>')
    expect(message.html).not.toContain('<img src=x>')
    expect(message.html).toContain('&lt;script&gt;Checkout failed&lt;/script&gt;')
    expect(message.html).toContain('/site%2F%3Cbad%3E/flags/%3Cflag%3E?')
    expect(message.text).toContain('<script>Checkout failed</script>')
  })
  it('states verified recovery without presenting new failure or missing observations as recovery', () => {
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [], recoveries: [{ id: 'fixed', problem: 'The observed failure' }] })
    expect(message.subject).toBe('example.com: 1 problem resolved')
    expect(message.text).toContain('We checked again and did not find this problem.')
    expect(load(message.html)('h2').text()).not.toContain('Needs attention')
    expect(message.text).not.toContain('See what to do next')
    expect(message.text).toContain('View details:')
  })

  it('pairs each old problem with the scoped recheck result in HTML and plain text', () => {
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null,
      checkedAt: new Date('2026-11-02T09:00:00Z'), regressions: [],
      recoveries: [{ id: 'image', problem: 'The product image did not load.' }, { id: 'title', problem: 'The page title was missing.' }] })
    const $ = load(message.html)
    const comparisons = $('table').filter((_, el) => $(el).children('tbody').children('tr').length === 2)
    expect(comparisons).toHaveLength(2)
    for (const [index, problem] of ['The product image did not load.', 'The page title was missing.'].entries()) {
      const rows = comparisons.eq(index).find('tr')
      expect(rows.eq(0).text()).toContain(`Before\n${problem}`)
      expect(rows.eq(1).text()).toContain('Now\nWe checked again and did not find this problem.')
      expect(message.text).toContain(`Before\n\n${problem}:`)
    }
    expect(message.subject).toBe('example.com: 2 problems resolved')
    expect(message.text).not.toMatch(/recovery verified|all clear|everything works|we fixed/i)
    expect(message.html).not.toMatch(/<hr\b|border-(top|bottom|left|right):/)
  })

  it('identifies the recovered page without copying private URL components', () => {
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [], recoveries: [{ id: 'fixed', problem: 'Page title is missing',
        pageUrl: 'https://private-user:private-password@example.com/catalog?key=private-query#private-fragment' }] })
    for (const body of [message.html, message.text]) {
      expect(body).toContain('(/catalog)')
      expect(body).toContain('/sites/site/flags/fixed?source=watch-email')
      expect(body).not.toMatch(/private-(user|password|query|fragment)/)
    }
  })

  it('does not invent a passing before state for a newly found problem', () => {
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [{ id: 'checkout', problem: 'Checkout failed.' }], recoveries: [] })
    expect(message.text).toContain('Checkout failed.')
    expect(message.text).not.toMatch(/Before|What improved|Found in this check|See what to do next|previously worked/)
    const $ = load(message.html)
    expect($('h2')).toHaveLength(0)
    const action = $('a').filter((_, element) => $(element).text() === 'View details')
    expect(action).toHaveLength(1)
    expect(action.attr('href')).toContain('/sites/site/flags/checkout?source=watch-email')
  })

  it('preserves every remaining source reference in bounded agent attachments', () => {
    const ids = Array.from({ length: 5000 }, (_, i) => `${String(i).padStart(4, '0')}-${'x'.repeat(195)}`)
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: ids.map(id => ({ id })), recoveries: [] })
    const received = message.attachments!.flatMap(file => {
      expect(Buffer.byteLength(file.content)).toBeLessThanOrEqual(1024 * 1024)
      const text = Buffer.from(file.content, 'base64').toString('utf8')
      expect(text).toContain('This text contains no access credential')
      return JSON.parse(text.split('Source Flag IDs: ')[1]) as string[]
    })
    expect(received).toEqual(ids.slice(6))
    expect(message.attachments!.length).toBeLessThanOrEqual(8)
    expect(Buffer.byteLength(message.html)).toBeLessThan(128 * 1024)
  })
  it('keeps long notifications bounded and does not silently drop findings with missing copy', () => {
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: Array.from({ length: 9 }, (_, index) => ({ id: `problem-${index}` })),
      recoveries: [{ id: 'fixed', problem: 'Old problem' }] })
    expect(message.text.match(/A problem needs your attention\./g)).toHaveLength(6)
    expect(message.text).toContain('4 more updates')
    const remaining = message.attachments!.map(file => Buffer.from(file.content, 'base64').toString('utf8')).join('\n')
    for (const id of ['problem-6', 'problem-7', 'problem-8']) expect(remaining).toContain(id)
    expect(remaining).toContain('This is the first read of each remaining source')
    expect(remaining).toContain('Download complete instructions')
    expect(remaining).not.toContain('ask the owner to connect their tool')
    expect(message.html).not.toContain('/flags/problem-8?')
    expect(Buffer.byteLength(message.html)).toBeLessThan(20_000)
    const empty = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [], recoveries: [] })
    expect(empty.subject).toBe('example.com: Website update')
    expect(empty.text).not.toContain('resolved')
    expect(empty.text).toContain('View website:')
  })
})
