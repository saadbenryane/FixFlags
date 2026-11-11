import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('marketing layout static rendering', () => {
  it('does not read request headers, so public pages can be statically generated', () => {
    const layout = readFileSync(join(process.cwd(), 'app/(marketing)/layout.tsx'), 'utf8')
    expect(layout).not.toMatch(/headers\s*\(/)
    expect(layout).not.toMatch(/x-pathname/)
    expect(layout).toMatch(/MarketingShell/)
  })

  it('mounts knowledge support from the help layout, which also hosts the FAQ', () => {
    const help = readFileSync(join(process.cwd(), 'app/(marketing)/help/layout.tsx'), 'utf8')
    const helpPage = readFileSync(join(process.cwd(), 'app/(marketing)/help/page.tsx'), 'utf8')
    expect(help).toMatch(/KnowledgeSupportShell/)
    expect(helpPage).toMatch(/id="faq"/)
  })
})
