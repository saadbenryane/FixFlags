import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// globals is false in vitest.config.ts, so Testing Library's automatic
// cleanup never registers; do it explicitly.
afterEach(() => cleanup())

// jsdom does not implement matchMedia. Components that respond to color
// scheme or reduced-motion queries (score spine, overlays, reveal-on-view)
// share one deterministic stub so they render in the light, motion-on state.
// Test files may override this with their own stub (identical semantics);
// never unstub globals here, or file-level beforeAll stubs (for example
// IntersectionObserver in the homepage tests) would be wiped mid-file.
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  )
})
