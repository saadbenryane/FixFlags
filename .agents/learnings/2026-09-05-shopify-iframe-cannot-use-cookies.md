# Shopify embedded apps cannot use a first-party cookie as the session

Chrome treats the Admin iframe as third-party. A signed `ff_shopify_shop` cookie set on OAuth callback is not sent on later `/api/shopify/recheck` calls, so Recheck/Slack/waitlist 401 after a "successful" install.

Designed session: App Bridge ID token on every mutation (`Authorization: Bearer`), JWT verified with the API secret, expiring offline access tokens with refresh for background walks. Fixture mode uses a signed fixture token and is rejected in production.
