import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// globals is false in vitest.config.ts, so Testing Library's automatic
// cleanup never registers; do it explicitly.
afterEach(() => cleanup())
