# Font runtime verification needs contract readiness

Date: 2026-08-25.

The font runtime verifier previously waited for Playwright `networkidle` on the application homepage.
Normal application traffic can prevent network silence and make the optional font gate time out even when the fonts are correct.
Waiting for the page `load` event is not sufficient by itself because a development refresh can briefly expose an empty body before styles are applied.
The stable contract is to wait for the `font-variables` body class and a non-empty computed `--font-sans` value before reading computed fonts.
`scripts/verify-font-runtime.mjs` now checks those exact readiness signals.
