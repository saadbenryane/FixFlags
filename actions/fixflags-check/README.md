# FixFlags GitHub Action

Run a Launch Check against a preview or production URL from CI.

## Usage

```yaml
name: FixFlags Launch Check
on:
  deployment_status:

jobs:
  fixflags:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./actions/fixflags-check
        with:
          url: ${{ github.event.deployment_status.target_url }}
          api-key: ${{ secrets.FIXFLAGS_API_KEY }}
          wait-for-completion: 'true'
```

Set `FIXFLAGS_API_KEY` in repository secrets. Generate one from **Settings → API keys** (Pro or Agency).

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `url` | yes | — | Public HTTPS URL to check |
| `api-key` | yes | — | FixFlags API key |
| `mode` | no | `critical_path` | `single` or `critical_path` |
| `wait-for-completion` | no | `true` | Poll until the report completes |
| `fail-on-issues` | no | `false` | Fail when Finish Plan has items |
| `base-url` | no | `https://fixflags.com` | API base URL |

## Re-check after fixes

```yaml
- run: npx fixflags@0.2.0-beta.1 recheck "$REPORT_ID" --wait
  env:
    FIXFLAGS_API_KEY: ${{ secrets.FIXFLAGS_API_KEY }}
```
