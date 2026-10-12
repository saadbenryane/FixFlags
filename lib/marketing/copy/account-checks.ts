export const ACCOUNT_CHECK_COPY = {
  title: 'Automatic account checks', enabled: 'Test signup and signed-in pages',
  body: 'FixFlags creates and reuses its own test account to inspect signed-in pages. A separate disposable account tests signup and deletion initially, when the signup form changes, or when you request it.',
  email: 'Test emails use unique plus aliases. FixFlags receives and completes supported verification links and codes automatically.',
  retention: 'Test accounts can remain when account deletion is unavailable or unsuccessful.',
  saved: 'Account-check preference saved.', saving: 'Saving account-check preference…',
  retest: 'Test signup again', cleanup: 'Delete FixFlags test accounts', requested: 'Account check requested. Results will appear here and in Timeline.',
  none: 'No account checks have completed yet.', retained: 'Reusable account', disposable: 'Disposable account',
  accountStates: { RESERVED: 'Ready to test', SUBMITTING: 'Signup pending', VERIFYING: 'Waiting for verification', ACTIVE: 'Ready for signed-in checks', DELETING: 'Deletion pending', DELETED: 'Deletion verified' },
  kinds: { signup: 'Signup', verification: 'Email verification', signed_in: 'Signed-in pages', deletion: 'Account deletion' },
  states: { verified: 'Verified', failed: 'Problem found', unavailable: 'Unavailable', unknown: 'Not verified' },
} as const
