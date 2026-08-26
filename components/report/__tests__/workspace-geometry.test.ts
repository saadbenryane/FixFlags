import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  WORKSPACE_PANE_SCROLL_CLASS,
  WORKSPACE_REPORT_FRAME_CLASS,
  WORKSPACE_STAGE_CLASS,
  WORKSPACE_VIEWPORT_CLASS,
} from '@/components/report/workspace-geometry'

describe('workspace stage geometry', () => {
  it('stays a flex column with a small-screen floor so a stacked capture cannot collapse', () => {
    // The stacked pane takes its height from the floor, not from a definite
    // parent height, so an `h-full` capture inside a block stage measured 0.
    expect(WORKSPACE_STAGE_CLASS).toContain('flex')
    expect(WORKSPACE_STAGE_CLASS).toContain('flex-col')
    expect(WORKSPACE_STAGE_CLASS).toContain('min-h-[18rem]')
    expect(WORKSPACE_STAGE_CLASS).toContain('flex-1')
  })

  it('fills the viewport beneath the slim header token, not a hardcoded 3.5rem', () => {
    expect(WORKSPACE_VIEWPORT_CLASS).toContain('100dvh-var(--header-height)')
    expect(WORKSPACE_VIEWPORT_CLASS).not.toContain('3.5rem')
  })
})

describe('report pane geometry', () => {
  it('makes the pane the query container so report surfaces measure the pane', () => {
    expect(WORKSPACE_PANE_SCROLL_CLASS).toContain('@container/pane')
    expect(WORKSPACE_PANE_SCROLL_CLASS).toContain('overflow-y-auto')
  })

  it('gives the report frame one pane height once the pane can hold list and detail', () => {
    expect(WORKSPACE_REPORT_FRAME_CLASS).toContain('@[40rem]/pane:h-full')
    expect(WORKSPACE_REPORT_FRAME_CLASS).toContain('min-h-[26rem]')
    expect(WORKSPACE_REPORT_FRAME_CLASS).not.toContain('vh')
  })

  it('keeps the fix explorer pane-relative, never viewport-relative', () => {
    const explorer = readFileSync('components/report/ReportExplorer.tsx', 'utf8')
    expect(explorer).not.toContain('100vh')
    expect(explorer).not.toContain('--header-offset')
    expect(explorer).not.toContain('overflow-clip')
    expect(explorer).not.toMatch(/\blg:/)
    expect(explorer).toContain('@[40rem]/pane:grid-cols-')
  })
})
