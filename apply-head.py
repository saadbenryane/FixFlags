from pathlib import Path

# CompletedReportView HEAD
p = Path('/tmp/ff-head/CompletedReportView.tsx')
src = p.read_text()
old = '''      isLoggedIn={state.isLoggedIn}
      isOwner={state.isOwner}
      compareAuditId={compareAuditId}'''
new = '''      isLoggedIn={state.isLoggedIn}
      isOwner={state.isOwner}
      isClaimedAnonymous={state.reportAudit.accessContext === 'anonymous_teaser'}
      compareAuditId={compareAuditId}'''
if old not in src:
    raise SystemExit('HEAD CompletedReportView props not found')
p.write_text(src.replace(old, new, 1))
print('HEAD CompletedReportView ok')

# explorer-model HEAD
p = Path('/tmp/ff-head/explorer-model.ts')
src = p.read_text()
old = '''    polishPassPrompt:
      (input.promptAccess ?? 'all') === 'all' ? fixList.copyPrompt : null,'''
new = '''    polishPassPrompt: fixList.copyPrompt,'''
if old not in src:
    raise SystemExit('HEAD live polishPassPrompt not found')
src = src.replace(old, new)
old = '''export function buildSampleExplorerModel(
  report: SampleReportDisplay,
  options: { promptAccess?: 'one' | 'all' | 'none' } = {}
): ReportExplorerModel {
  const promptAccess = options.promptAccess ?? 'one'
  return {
    displayHost: report.displayHost,
    pageType: report.pageType,
    score: report.score,
    flagCount: report.flagCount,
    polishPassPrompt: null,
'''
new = '''export function buildSampleExplorerModel(
  report: SampleReportDisplay,
  options: { promptAccess?: 'one' | 'all' | 'none' } = {}
): ReportExplorerModel {
  const promptAccess = options.promptAccess ?? 'one'
  const rankedOpenFlags: RankableFlag[] = report.flags.map((flag) => ({
    id: flag.id,
    checkId: flag.checkId ?? null,
    rubric: flag.rubric as RankableFlag['rubric'],
    severity: flag.severity as RankableFlag['severity'],
    problem: flag.title,
    evidence: flag.evidence,
    fix: flag.fixPrompt,
  }))
  return {
    displayHost: report.displayHost,
    pageType: report.pageType,
    score: report.score,
    flagCount: report.flagCount,
    polishPassPrompt:
      promptAccess === 'none'
        ? null
        : buildPlanModePrompt(rankedOpenFlags, { limit: rankedOpenFlags.length }) || null,
'''
if old not in src:
    raise SystemExit('HEAD buildSampleExplorerModel not found')
p.write_text(src.replace(old, new))
print('HEAD explorer-model ok')

# explorer-model.test HEAD
p = Path('/tmp/ff-head/explorer-model.test.ts')
src = p.read_text()
old = '''    assert.equal(
      model.flags.find((flag) => flag.id === 'f2')?.copyFixPrompt,
      'Move the primary CTA into the initial mobile viewport.'
    )
    assert.equal(model.polishPassPrompt, null)
'''
new = '''    assert.equal(
      model.flags.find((flag) => flag.id === 'f2')?.copyFixPrompt,
      'Move the primary CTA into the initial mobile viewport.'
    )
    assert.match(
      model.polishPassPrompt ?? '',
      /^Make a plan to fix these issues, then implement them in this product\\./
    )
    assert.match(model.polishPassPrompt ?? '', /CTA below fold/)
    assert.match(model.polishPassPrompt ?? '', /Generic headline/)
    assert.match(model.polishPassPrompt ?? '', /Search title is too short/)
    assert.match(model.polishPassPrompt ?? '', /1\\. /)
    assert.match(model.polishPassPrompt ?? '', /2\\. /)
    assert.match(model.polishPassPrompt ?? '', /3\\. /)
'''
if old not in src:
    raise SystemExit('HEAD explorer-model.test block not found')
p.write_text(src.replace(old, new))
print('HEAD explorer-model.test ok')

# workspace-adapters.test HEAD
p = Path('/tmp/ff-head/workspace-adapters.test.ts')
src = p.read_text()
if "import { AGENT_COPY_LEAD }" not in src:
    src = src.replace(
        "import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'\n",
        "import { AGENT_COPY_LEAD } from '@/lib/audit/priority-flags'\nimport { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'\n",
    )
old = '''    expect(sample.explorer.polishPassPrompt).toBeNull()
'''
new = '''    expect(sample.explorer.polishPassPrompt?.split('\\n', 1)[0]).toBe(AGENT_COPY_LEAD)
    expect(sample.explorer.polishPassPrompt).toMatch(/1\\. /)
    const numbered = sample.explorer.polishPassPrompt?.match(/^\\d+\\. /gm) ?? []
    expect(numbered).toHaveLength(sample.explorer.flagCount)
'''
if old not in src:
    raise SystemExit('HEAD workspace-adapters polishPassPrompt not found')
p.write_text(src.replace(old, new))
print('HEAD workspace-adapters.test ok')

# task-contracts HEAD
p = Path('/tmp/ff-head/task-contracts.ts')
src = p.read_text()
old = '''export async function recheckAndCompare(options: TaskQueueOptions & {
  parentReportId: string
  user: User
  clientId?: string
}): Promise<RecheckAndCompareOutcome> {
  const started = await startMonitoringAudit(options.parentReportId, options.user, {
    delayMs: options.delayMs,
    clientId: options.clientId,
  })
'''
new = '''export async function recheckAndCompare(options: TaskQueueOptions & {
  parentReportId: string
  user: User | null
  claimedAnonymous?: boolean
  clientId?: string
}): Promise<RecheckAndCompareOutcome> {
  const started = await startMonitoringAudit(options.parentReportId, options.user, {
    delayMs: options.delayMs,
    clientId: options.clientId,
    claimedAnonymous: options.claimedAnonymous,
  })
'''
if old not in src:
    raise SystemExit('HEAD recheckAndCompare not found')
p.write_text(src.replace(old, new))
print('HEAD task-contracts ok')

# ReportExplorer.test HEAD
p = Path('/tmp/ff-head/ReportExplorer.test.tsx')
src = p.read_text()
src = src.replace(
'''vi.mock('@/lib/analytics/events', () => ({
  trackEvent: vi.fn(),
}))
''',
'''vi.mock('@/lib/analytics/events', () => ({
  trackEvent: vi.fn(),
}))

const writeText = vi.fn().mockResolvedValue(undefined)
Object.assign(navigator, { clipboard: { writeText } })
''')
old = '''    expect(await screen.findByText('Flagged on desktop')).toBeInTheDocument()
    expect(screen.getByText('Not flagged on mobile')).toBeInTheDocument()
  })
})
'''
new = '''    expect(await screen.findByText('Flagged on desktop')).toBeInTheDocument()
    expect(screen.getByText('Not flagged on mobile')).toBeInTheDocument()
  })

  it('copies every ranked open flag from polishPassPrompt, not one CTA', async () => {
    const polishPassPrompt = `${AGENT_COPY_LEAD}

1. [CRITICAL · Experience · HIGH] CTA below fold
   Fix: Move the CTA up.
2. [IMPORTANT · Message · MEDIUM] Generic headline
   Fix: Name the outcome.`
    render(
      <MeProvider initialUser={null}>
        <ReportExplorer
          model={{
            ...model,
            polishPassPrompt,
            flags: [locked, demonstrated],
            flagCount: 2,
          }}
        />
      </MeProvider>
    )

    const copyAll = screen.getByRole('button', { name: /Copy Finish Plan/i })
    fireEvent.click(copyAll)
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled()
    })
    const copied = writeText.mock.calls[0]?.[0] as string
    expect(copied.split('\\n', 1)[0]).toBe(AGENT_COPY_LEAD)
    expect(copied).toMatch(/1\\. /)
    expect(copied).toMatch(/2\\. /)
    expect(copied).toContain('CTA below fold')
    expect(copied).toContain('Generic headline')
  })
})
'''
if old not in src:
    raise SystemExit('HEAD ReportExplorer.test end not found')
p.write_text(src.replace(old, new))
print('HEAD ReportExplorer.test ok')
print('all HEAD patches applied')
