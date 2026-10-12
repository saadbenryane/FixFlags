import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

describe('public page initial bundles', () => {
  it.each([
    'components/audit/AuditInput.tsx',
    'components/layout/header.tsx',
    'components/docs/DocsNavigation.tsx',
  ])('keeps authentication and unrelated copy out of the initial load of %s', async entry => {
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      splitting: true,
      write: false,
      outdir: 'bundle-check',
      format: 'esm',
      platform: 'browser',
      external: ['next', 'next/*', 'react', 'react-dom', 'react-dom/*', 'react/jsx-runtime'],
      metafile: true,
      logLevel: 'silent',
    })
    const outputs = result.metafile!.outputs
    const visited = new Set<string>()
    const initialInputs = new Set<string>()
    function visit(file: string) {
      if (visited.has(file)) return
      visited.add(file)
      for (const input of Object.keys(outputs[file].inputs)) initialInputs.add(input)
      for (const dependency of outputs[file].imports) {
        if (!dependency.external && dependency.kind !== 'dynamic-import') visit(dependency.path)
      }
    }
    visit(Object.entries(outputs).find(([, output]) => output.entryPoint === entry)![0])
    expect(initialInputs.has('components/auth/AuthFlow.tsx')).toBe(false)
    expect(initialInputs.has('lib/marketing/copy.ts')).toBe(false)
    expect([...initialInputs].some(input => input.includes('node_modules/better-auth/'))).toBe(false)
  })
})
