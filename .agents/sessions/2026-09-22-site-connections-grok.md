# Site connections

Date: 2026-09-22
Task: site-connections

Search Console and Analytics connect per Site. A property is stored only when its host matches that Site. Tokens are encrypted. Stored facts are aggregates for the last 28 days. Search and tracking cards, and a Flag page, can show those numbers as context. The numbers do not change an Outcome or Flag verdict.

Shopify install code was left in place. The settings screen already showed that connection and still does.

Google sign-in uses `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, or the existing Search Console client pair. The callback is `/api/sites/connections/google/callback`. A real Google account was not exercised in this session.
