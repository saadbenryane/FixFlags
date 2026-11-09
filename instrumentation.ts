export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { validateProductionEnv } = await import('@/lib/env')
      validateProductionEnv()
    } catch (error) {
      // Standalone Next can log a failed instrumentation hook and keep serving.
      console.error('Web runtime configuration is invalid', error)
      process.exit(1)
    }
  }
}
