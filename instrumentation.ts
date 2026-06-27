export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateProductionEnv } = await import('@/lib/env')
    validateProductionEnv()
    // Run the audit worker in-process by default so a single service works out
    // of the box. Disabled with INLINE_WORKER=false when using dedicated workers.
    const { startInlineWorkerOnce } = await import('@/lib/queue/inline-worker')
    startInlineWorkerOnce()
  }
}
