# return-after-signup

objective: A stranger who started a check can create an account and come back to that Site
outcome: Sign in from the learning board keeps the Site address, account creation succeeds locally, and the same Site is still there after sign-in
surfaces: auth return path only if the walk shows a blocker outside other claims
dependencies: does not edit lib/marketing/copy, pricing, Shopify, or Site connection settings
status: complete
agent: grok-goal-18c5ed77dbc7
timestamp: 2026-09-23T23:36:00Z
completed: 2026-09-23T23:40:00Z
verification: From the anonymous example.com board, Sign in kept next=/sites/p_cmuenwglk000igukcw98426n8. Create account returned 200, post-login claim returned 200, and Maybe later on the passkey step opened that same Site signed in. The board still showed example.com in a learning state. No product code change. Signup logs "Email verification is not configured" when Resend is absent; the account still signs in because verification is not required.
remaining: The first check stays queued until a worker runs, while the board says live analysis is in progress.
next: first-check-progress
