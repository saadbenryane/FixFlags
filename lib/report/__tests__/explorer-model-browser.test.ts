import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

describe('report explorer browser boundary', () => {
  it('bundles the display model without server-only networking dependencies', async () => {
    const result = await build({
      entryPoints: ['lib/report/explorer-model.ts'],
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'esm',
      metafile: true,
      logLevel: 'silent',
    })
    expect(Object.keys(result.metafile!.inputs)).not.toContain('lib/audit/open-check.ts')
    expect(result.outputFiles[0].text).not.toMatch(/node:(?:dns|net)/)
  })
})
