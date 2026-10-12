import test from 'node:test'
import assert from 'node:assert/strict'
import { brandColorViolations } from './brand-hex-guard.mjs'

test('brand guard distinguishes link fragments and scanner documents from product colors', () => {
  assert.deepEqual(brandColorViolations('components/Link.tsx', '<a href="#abc">Link</a>'), [])
  assert.deepEqual(brandColorViolations('lib/links.ts', 'const fragment = "#caf%C3%A9"'), [])
  assert.deepEqual(brandColorViolations('lib/audit/checks/contrast.test.ts', '<p style="color:#111;background:#bbb">Example</p>'), [])
  assert.deepEqual(brandColorViolations('components/Button.tsx', '<button style={{ color: "#fff" }}>Go</button>'), ['#fff'])
  assert.deepEqual(brandColorViolations('components/__tests__/Button.test.tsx', '<button style={{ color: "#fff" }}>Go</button>'), ['#fff'])
  assert.deepEqual(brandColorViolations('lib/ui.ts', 'const color = "#abc"'), ['#abc'])
  assert.deepEqual(brandColorViolations('components/Link.tsx', '<a href="#abc" style={{color:"#fff"}}>Go</a>'), ['#fff'])
})
